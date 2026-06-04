import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTO_ENABLE_CONFIDENCE,
  decideTagDisposition,
  normalizeDocumentType,
} from "../src/lib/criterion-routing.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JOBS_FILE = path.join(ROOT, "storage", "state", "jobs.json");
const OUTPUT_DIR = path.join(ROOT, "storage", "exports", "auto-tag-calibration");
const QDRANT_URL = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
const QDRANT_COLLECTION =
  process.env.QDRANT_COLLECTION ?? "eb1a_evidence_documents";

function parseArgs(argv) {
  const result = {
    jobIds: [],
    out: null,
    useAllJobs: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--job" && argv[index + 1]) {
      result.jobIds.push(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === "--out" && argv[index + 1]) {
      result.out = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--all") {
      result.useAllJobs = true;
    }
  }

  return result;
}

async function readJobs() {
  const raw = await fs.readFile(JOBS_FILE, "utf8");
  const payload = JSON.parse(raw);
  return Array.isArray(payload.jobs) ? payload.jobs : [];
}

async function fetchDocumentsForJob(jobId) {
  const documents = [];
  let nextOffset = null;

  do {
    const response = await fetch(
      `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/scroll`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: 256,
          with_payload: true,
          with_vector: false,
          filter: {
            must: [
              {
                key: "jobId",
                match: {
                  value: jobId,
                },
              },
            ],
          },
          offset: nextOffset,
        }),
      },
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Qdrant scroll failed for ${jobId}: ${message}`);
    }

    const payload = await response.json();
    const result = payload.result ?? {};
    const points = Array.isArray(result.points) ? result.points : [];

    points.forEach((point) => {
      if (point?.payload && typeof point.payload === "object") {
        documents.push(point.payload);
      }
    });

    nextOffset = result.next_page_offset ?? null;
  } while (nextOffset);

  return documents;
}

function buildRows(jobId, document) {
  const tags = Array.isArray(document.criteriaTags) ? document.criteriaTags : [];
  const attorneyEnabledCodes = new Set(
    tags
      .filter(
        (tag) =>
          tag &&
          typeof tag === "object" &&
          tag.origin === "attorney" &&
          tag.state === "enabled",
      )
      .map((tag) => String(tag.code ?? tag.criterionCode ?? "")),
  );
  const normalizedType = normalizeDocumentType(document.summary?.documentType);

  return tags
    .filter(
      (tag) => tag && typeof tag === "object" && tag.origin !== "attorney",
    )
    .map((tag) => {
      const proposedCriterion = String(tag.code ?? tag.criterionCode ?? "");
      const confidence =
        typeof tag.aiConfidence === "number"
          ? tag.aiConfidence
          : typeof tag.confidence === "number"
            ? tag.confidence
            : 0;
      const decision = decideTagDisposition({
        bundleId: String(document.id ?? `${jobId}:${document.fileName ?? "document"}`),
        proposedCriterionCode: proposedCriterion,
        modelConfidence: confidence,
        documentType: normalizedType,
      });

      return {
        jobId,
        documentId: String(document.id ?? ""),
        fileName: String(document.fileName ?? ""),
        documentType: normalizedType,
        proposedCriterion,
        confidence,
        disposition: decision.disposition,
        correct:
          attorneyEnabledCodes.size > 0
            ? attorneyEnabledCodes.has(proposedCriterion)
            : null,
      };
    });
}

function summarize(rows) {
  const labeledRows = rows.filter((row) => row.correct !== null);
  const autoEnabledRows = labeledRows.filter(
    (row) => row.disposition === "auto_enable",
  );
  const autoEnabledCorrect = autoEnabledRows.filter((row) => row.correct === true);

  return {
    threshold: AUTO_ENABLE_CONFIDENCE,
    totalRows: rows.length,
    labeledRows: labeledRows.length,
    autoEnabledRows: autoEnabledRows.length,
    autoEnabledCorrect: autoEnabledCorrect.length,
    autoEnablePrecision:
      autoEnabledRows.length > 0
        ? autoEnabledCorrect.length / autoEnabledRows.length
        : null,
  };
}

async function writeRows(outputPath, rows) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  await fs.writeFile(outputPath, `${body}${body ? "\n" : ""}`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jobs = await readJobs();
  const selectedJobs = args.useAllJobs
    ? jobs
    : args.jobIds.length > 0
      ? jobs.filter((job) => args.jobIds.includes(job.id))
      : jobs.slice(0, 1);

  if (selectedJobs.length === 0) {
    throw new Error("No matching jobs were found. Pass --job <workspace-id>.");
  }

  const rows = [];

  for (const job of selectedJobs) {
    const documents = await fetchDocumentsForJob(job.id);
    documents.forEach((document) => {
      rows.push(...buildRows(job.id, document));
    });
  }

  const jobKey =
    selectedJobs.length === 1
      ? selectedJobs[0].id
      : `${selectedJobs.length}-jobs`;
  const outputPath =
    args.out ? path.resolve(ROOT, args.out) : path.join(OUTPUT_DIR, `${jobKey}.jsonl`);

  await writeRows(outputPath, rows);

  const summary = summarize(rows);

  console.log(
    JSON.stringify(
      {
        jobs: selectedJobs.map((job) => ({
          id: job.id,
          folderLabel: job.folderLabel,
        })),
        outputPath,
        ...summary,
        note:
          summary.autoEnablePrecision === null
            ? "No attorney-labeled auto-enable examples were available in the selected workspace set."
            : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
