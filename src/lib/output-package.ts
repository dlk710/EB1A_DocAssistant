import fs from "node:fs/promises";
import path from "node:path";
import {
  EB1A_CRITERIA_DEFINITIONS,
  SPECIAL_REVIEW_BUCKET_DEFINITIONS,
} from "@/lib/constants";
import { getDecisionBucket } from "@/lib/review-routing";
import { ensureStorageRoots } from "@/lib/state-store";
import type {
  Eb1aCriterionDecision,
  EventBundle,
  OutputArtifactReference,
  StoredDocument,
} from "@/lib/types";

function slugifySegment(value: string, fallback: string) {
  const normalized = value
    .replace(/[^\w\s.-]+/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 96);

  if (!normalized) {
    return fallback;
  }

  return normalized.replace(/\s/g, "_");
}

function formatStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function escapeMarkdown(value: string) {
  return value.replace(/[<>]/g, "");
}

function relativeArtifactPath(outputFolderPath: string, targetPath: string) {
  return path.relative(outputFolderPath, targetPath).replace(/\\/g, "/");
}

function criterionFolderName(decision: Eb1aCriterionDecision) {
  return getDecisionBucket(decision).folderName;
}

function criterionLabel(decision: Eb1aCriterionDecision) {
  if (!decision.primaryCriterionCode || !decision.primaryCriterionName) {
    return getDecisionBucket(decision).bucketName;
  }

  return `${decision.primaryCriterionCode} — ${decision.primaryCriterionName}`;
}

async function writeJson(targetPath: string, value: unknown) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(targetPath: string, value: string) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, value, "utf8");
}

interface CreateOutputPackageInput {
  jobId: string;
  folderLabel: string;
  candidateName: string;
  outputRootPath: string;
  bundles: EventBundle[];
  decisions: Eb1aCriterionDecision[];
  documents: StoredDocument[];
}

export async function createOutputPackage(input: CreateOutputPackageInput): Promise<{
  outputFolderPath: string;
  outputArtifacts: OutputArtifactReference[];
}> {
  ensureStorageRoots();
  await fs.mkdir(input.outputRootPath, { recursive: true });

  const workspaceFolderName = `${slugifySegment(
    input.folderLabel,
    "workspace",
  )}__${input.jobId.slice(0, 8)}__${formatStamp()}`;
  const outputFolderPath = path.join(input.outputRootPath, workspaceFolderName);

  await fs.mkdir(outputFolderPath, { recursive: true });

  for (const criterion of EB1A_CRITERIA_DEFINITIONS) {
    await fs.mkdir(path.join(outputFolderPath, criterion.folderName), { recursive: true });
  }

  for (const bucket of SPECIAL_REVIEW_BUCKET_DEFINITIONS) {
    await fs.mkdir(path.join(outputFolderPath, bucket.folderName), { recursive: true });
  }

  await fs.mkdir(path.join(outputFolderPath, "_Reference"), { recursive: true });

  const bundleLookup = new Map(input.bundles.map((bundle) => [bundle.id, bundle]));
  const documentLookup = new Map(input.documents.map((document) => [document.id, document]));
  const copiedBundles: Array<Record<string, unknown>> = [];
  const allReferences: Array<Record<string, unknown>> = [];

  for (const decision of input.decisions) {
    const bundle = bundleLookup.get(decision.bundleId);

    if (!bundle) {
      continue;
    }

    const bundleDocuments = bundle.evidenceDocumentIds
      .map((documentId) => documentLookup.get(documentId))
      .filter((document): document is StoredDocument => Boolean(document));

    const bundleFolderName = `${
      bundle.latestRelevantDate ? `${bundle.latestRelevantDate}__` : ""
    }${slugifySegment(decision.suggestedExhibitTitle || bundle.name, "event")}`;
    const targetFolder = path.join(
      outputFolderPath,
      criterionFolderName(decision),
      bundleFolderName,
    );
    await fs.mkdir(targetFolder, { recursive: true });

    const copiedFiles: Array<Record<string, unknown>> = [];
    const usedNames = new Set<string>();

    for (const document of bundleDocuments) {
      let targetName = document.fileName || path.basename(document.absolutePath);

      while (usedNames.has(targetName)) {
        targetName = `${document.id.slice(0, 6)}_${targetName}`;
      }

      usedNames.add(targetName);
      const copiedPath = path.join(targetFolder, targetName);
      await fs.copyFile(document.absolutePath, copiedPath);

      const reference = {
        documentId: document.id,
        title: document.summary?.title || document.fileName,
        originalRelativePath: document.relativePath,
        originalAbsolutePath: document.absolutePath,
        copiedRelativePath: relativeArtifactPath(outputFolderPath, copiedPath),
        primaryDate: document.summary?.primaryDate ?? null,
        documentType: document.summary?.documentType || document.extension,
      };

      copiedFiles.push(reference);
      allReferences.push({
        bundleId: bundle.id,
        bundleName: bundle.name,
        criterion: criterionLabel(decision),
        ...reference,
      });
    }

    const bundleJsonPath = path.join(targetFolder, "_bundle.json");
    const bundleMdPath = path.join(targetFolder, "_bundle.md");

    await writeJson(bundleJsonPath, {
      jobId: input.jobId,
      candidateName: input.candidateName,
      bundle,
      decision,
      files: copiedFiles,
    });

    await writeText(
      bundleMdPath,
      [
        `# ${decision.suggestedExhibitTitle || bundle.name}`,
        "",
        `- Candidate: ${input.candidateName || "Not set"}`,
        `- Criterion: ${criterionLabel(decision)}`,
        `- Confidence: ${decision.confidence}`,
        `- Event type: ${bundle.eventType}`,
        `- Latest relevant date: ${bundle.latestRelevantDate || "Not specified"}`,
        `- Location: ${bundle.location}`,
        "",
        "## Rationale",
        "",
        decision.rationale,
        "",
        decision.unclassifiedReason
          ? `## Human Review Note\n\n${decision.unclassifiedReason}\n`
          : "",
        "## Event Summary",
        "",
        bundle.detailedSummary,
        "",
        "## Evidence Files",
        "",
        ...copiedFiles.map(
          (file) =>
            `- ${escapeMarkdown(String(file.title))} — ${escapeMarkdown(
              String(file.originalRelativePath),
            )}`,
        ),
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    copiedBundles.push({
      bundleId: bundle.id,
      bundleName: bundle.name,
      exhibitTitle: decision.suggestedExhibitTitle,
      criterion: criterionLabel(decision),
      outputFolder: relativeArtifactPath(outputFolderPath, targetFolder),
      fileCount: copiedFiles.length,
    });
  }

  const referenceJsonPath = path.join(outputFolderPath, "_Reference", "_source_references.json");
  const indexJsonPath = path.join(outputFolderPath, "_index.json");
  const indexMdPath = path.join(outputFolderPath, "_index.md");
  const humanReviewMdPath = path.join(outputFolderPath, "_human_review.md");
  const classificationJsonPath = path.join(outputFolderPath, "_classification_summary.json");

  await writeJson(referenceJsonPath, {
    generatedAt: new Date().toISOString(),
    references: allReferences,
  });

  await writeJson(classificationJsonPath, {
    jobId: input.jobId,
    candidateName: input.candidateName,
    generatedAt: new Date().toISOString(),
    decisions: input.decisions,
    bundles: copiedBundles,
  });

  await writeJson(indexJsonPath, {
    jobId: input.jobId,
    candidateName: input.candidateName,
    generatedAt: new Date().toISOString(),
    outputFolderPath,
    bundleCount: copiedBundles.length,
    unclassifiedCount: input.decisions.filter(
      (decision) => decision.reviewDisposition === "unclassified",
    ).length,
    archiveCount: input.decisions.filter((decision) => decision.reviewDisposition === "archive")
      .length,
    unwantedCount: input.decisions.filter(
      (decision) => decision.reviewDisposition === "unwanted",
    ).length,
    bundles: copiedBundles,
  });

  const bundlesByCriterion = new Map<string, Array<Record<string, unknown>>>();

  for (const bundle of copiedBundles) {
    const criterion = String(bundle.criterion);
    const current = bundlesByCriterion.get(criterion) ?? [];
    current.push(bundle);
    bundlesByCriterion.set(criterion, current);
  }

  await writeText(
    indexMdPath,
    [
      `# Evidence Classification Index`,
      "",
      `- Candidate: ${input.candidateName || "Not set"}`,
      `- Workspace: ${input.folderLabel}`,
      `- Generated: ${new Date().toISOString()}`,
      `- Bundle count: ${copiedBundles.length}`,
      "",
      ...Array.from(bundlesByCriterion.entries()).flatMap(([criterion, bundles]) => [
        `## ${criterion}`,
        "",
        ...bundles.map(
          (bundle) =>
            `- ${escapeMarkdown(String(bundle.exhibitTitle || bundle.bundleName))} (${escapeMarkdown(
              String(bundle.outputFolder),
            )})`,
        ),
        "",
      ]),
    ].join("\n"),
  );

  const unclassifiedDecisions = input.decisions.filter(
    (decision) => decision.reviewDisposition === "unclassified",
  );
  const unwantedDecisions = input.decisions.filter(
    (decision) => decision.reviewDisposition === "unwanted",
  );

  await writeText(
    humanReviewMdPath,
    [
      "# Human Review Queue",
      "",
      unclassifiedDecisions.length || unwantedDecisions.length
        ? "These bundles were intentionally held outside the final EB1A folders for later review."
        : "No bundles are currently waiting in the human review queue.",
      "",
      "## Unclassified bundles",
      "",
      unclassifiedDecisions.length
        ? ""
        : "No bundles are currently waiting in the unclassified review queue.",
      "",
      ...unclassifiedDecisions.flatMap((decision) => {
        const bundle = bundleLookup.get(decision.bundleId);

        return [
          `## ${escapeMarkdown(bundle?.name || decision.suggestedExhibitTitle)}`,
          "",
          `${decision.unclassifiedReason || "No explicit reason was returned."}`,
          "",
          `- Suggested exhibit title: ${escapeMarkdown(decision.suggestedExhibitTitle)}`,
          `- Output folder: _Unclassified/${escapeMarkdown(
            `${bundle?.latestRelevantDate ? `${bundle.latestRelevantDate}__` : ""}${slugifySegment(
              decision.suggestedExhibitTitle || bundle?.name || "event",
              "event",
            )}`,
          )}`,
          "",
        ];
      }),
      "## Unwanted bundles",
      "",
      unwantedDecisions.length
        ? ""
        : "No bundles are currently waiting in the unwanted review queue.",
      "",
      ...unwantedDecisions.flatMap((decision) => {
        const bundle = bundleLookup.get(decision.bundleId);

        return [
          `## ${escapeMarkdown(bundle?.name || decision.suggestedExhibitTitle)}`,
          "",
          `${decision.unclassifiedReason || decision.rationale}`,
          "",
          `- Suggested exhibit title: ${escapeMarkdown(decision.suggestedExhibitTitle)}`,
          `- Output folder: _Unwanted/${escapeMarkdown(
            `${bundle?.latestRelevantDate ? `${bundle.latestRelevantDate}__` : ""}${slugifySegment(
              decision.suggestedExhibitTitle || bundle?.name || "event",
              "event",
            )}`,
          )}`,
          "",
        ];
      }),
    ].join("\n"),
  );

  const outputArtifacts: OutputArtifactReference[] = [
    {
      label: "Workspace index (Markdown)",
      relativePath: relativeArtifactPath(outputFolderPath, indexMdPath),
    },
    {
      label: "Workspace index (JSON)",
      relativePath: relativeArtifactPath(outputFolderPath, indexJsonPath),
    },
    {
      label: "Classification summary",
      relativePath: relativeArtifactPath(outputFolderPath, classificationJsonPath),
    },
    {
      label: "Human review queue",
      relativePath: relativeArtifactPath(outputFolderPath, humanReviewMdPath),
    },
    {
      label: "Source references",
      relativePath: relativeArtifactPath(outputFolderPath, referenceJsonPath),
    },
  ];

  return {
    outputFolderPath,
    outputArtifacts,
  };
}
