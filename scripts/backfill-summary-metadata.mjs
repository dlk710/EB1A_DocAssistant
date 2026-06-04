#!/usr/bin/env node

const QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "eb1a_evidence_documents";

function normalizeString(value, maxLength, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength).trim();
}

function normalizeStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => normalizeString(entry, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function enumFallback(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeSummary(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const publicationVenue = normalizeString(value.publicationVenue, 180);

  return {
    ...value,
    objectiveEvidence: enumFallback(
      value.objectiveEvidence,
      ["objective", "subjective", "mixed"],
      "mixed",
    ),
    publicationVenue: publicationVenue || null,
    publicationType: enumFallback(
      value.publicationType,
      [
        "peer_reviewed_journal",
        "conference_paper",
        "preprint",
        "editorial_or_opinion",
        "trade_press",
        "mainstream_media",
        "interview_or_placement",
        "press_release",
        "blog_or_self_published",
        "not_a_publication",
      ],
      "not_a_publication",
    ),
    reviewType: enumFallback(
      value.reviewType,
      [
        "double_blind",
        "single_blind",
        "open_review",
        "editorial_only",
        "unknown",
        "not_applicable",
      ],
      "not_applicable",
    ),
    urls: normalizeStringArray(value.urls, 20, 500),
    selfSolicitationSignals: normalizeStringArray(value.selfSolicitationSignals, 8, 220),
  };
}

async function qdrantFetch(path, init) {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Qdrant request failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function scrollAll() {
  const points = [];
  let offset = null;

  do {
    const payload = await qdrantFetch(`/collections/${QDRANT_COLLECTION}/points/scroll`, {
      method: "POST",
      body: JSON.stringify({
        limit: 128,
        offset: offset ?? undefined,
        with_payload: true,
        with_vector: false,
      }),
    });

    points.push(...(payload.result?.points ?? []));
    offset = payload.result?.next_page_offset ?? null;
  } while (offset !== null);

  return points;
}

function hasMissingSummaryMetadata(summary) {
  if (!summary || typeof summary !== "object") {
    return false;
  }

  return (
    !("objectiveEvidence" in summary) ||
    !("publicationVenue" in summary) ||
    !("publicationType" in summary) ||
    !("reviewType" in summary) ||
    !("urls" in summary) ||
    !("selfSolicitationSignals" in summary)
  );
}

async function backfill() {
  const dryRun = process.argv.includes("--dry-run");
  const points = await scrollAll();
  const candidates = points.filter((point) =>
    hasMissingSummaryMetadata(point.payload?.summary),
  );

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun,
          totalDocuments: points.length,
          documentsNeedingBackfill: candidates.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const point of candidates) {
    await qdrantFetch(`/collections/${QDRANT_COLLECTION}/points/payload?wait=true`, {
      method: "POST",
      body: JSON.stringify({
        points: [point.id],
        payload: {
          summary: normalizeSummary(point.payload.summary),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        totalDocuments: points.length,
        updated: candidates.length,
      },
      null,
      2,
    ),
  );
}

backfill().catch((error) => {
  console.error(error);
  process.exit(1);
});
