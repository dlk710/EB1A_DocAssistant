import Link from "next/link";
import { notFound } from "next/navigation";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { ActionItemsSummary } from "@/components/review/ActionItemsSummary";
import type { ReviewWorkspaceContext } from "@/components/review/RowContextMenu";
import type { ReviewDecisionItem } from "@/components/review/DecisionRow";
import type {
  ReviewBundleDecisionItem,
  ReviewBundleFitGroup,
  ReviewCategoryBandData,
} from "@/components/review/workflow-types";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";
import {
  getClient,
  getClientStageNumber,
  listClientJobs,
  listClients,
  updateClient,
} from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { ensureClientTimelineEvent } from "@/lib/timeline";
import type { ClientDocument, ClientStatus, LibrarySnapshot } from "@/lib/types";

const OTHER_REVIEW_BUCKET_CODE = "OTHER";

interface ClientReviewPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

function isWorkspaceReady(snapshot: LibrarySnapshot) {
  const jobStatus = snapshot.activeJob?.status;
  const jobReady = jobStatus === "completed" || jobStatus === "completed_with_errors";

  return Boolean(
    jobReady &&
      snapshot.eventBundles?.status === "completed" &&
      snapshot.eb1aClassification?.status === "completed" &&
      snapshot.criteriaTagging?.status === "completed",
  );
}

function dominantCriterionTag(document: ClientDocument) {
  const primary = document.criteriaTags.filter((tag) => tag.role === "primary");
  const pool = primary.length ? primary : document.criteriaTags;

  return [...pool].sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function buildWorkspaceContext(snapshot: LibrarySnapshot): ReviewWorkspaceContext | null {
  if (!snapshot.activeJobId) {
    return null;
  }

  const bundleLookup = new Map(
    (snapshot.eventBundles?.bundles ?? [])
      .filter((bundle) => bundle.bundleKind === "standard")
      .map((bundle) => [bundle.id, bundle]),
  );
  const bundleOptions: ReviewWorkspaceContext["bundleOptions"] = [
    ...(snapshot.eventBundles?.bundles ?? [])
      .filter((bundle) => bundle.bundleKind === "standard")
      .map((bundle) => ({
      id: bundle.id,
      jobId: bundle.jobId,
      parentBundleId: null,
      name: bundle.name,
      documentCount: bundle.evidenceDocumentIds.length,
      kind: "bundle" as const,
      })),
    ...(snapshot.reviewState?.subBundles ?? []).map((subBundle) => ({
      id: subBundle.id,
      jobId: subBundle.jobId,
      parentBundleId: subBundle.parentBundleId,
      name: bundleLookup.has(subBundle.parentBundleId)
        ? `${bundleLookup.get(subBundle.parentBundleId)?.name} → ${subBundle.name}`
        : subBundle.name,
      documentCount: subBundle.evidenceDocumentIds.length,
      kind: "sub_bundle" as const,
    })),
  ];

  return {
    jobId: snapshot.activeJobId,
    workspaceLabel: snapshot.activeJob?.folderLabel ?? "Workspace",
    bundleOptions,
  };
}

function deriveClientStatus(input: {
  clientStatus: ClientStatus;
  lockedStrategyVersion: number | null;
  snapshots: LibrarySnapshot[];
  unresolvedFileCount: number;
  unresolvedBundleCount: number;
  unresolvedCriterionCount: number;
}) {
  if (input.clientStatus === "locked" || input.lockedStrategyVersion !== null) {
    return "locked" satisfies ClientStatus;
  }

  const allReady =
    input.snapshots.length > 0 && input.snapshots.every((snapshot) => isWorkspaceReady(snapshot));

  if (!allReady) {
    return "onboarding" satisfies ClientStatus;
  }

  if (
    input.unresolvedFileCount > 0 ||
    input.unresolvedBundleCount > 0 ||
    input.unresolvedCriterionCount > 0
  ) {
    return "reviewing" satisfies ClientStatus;
  }

  return "strategizing" satisfies ClientStatus;
}

function buildClientSwitcher(activeClientId: string, clients: ReturnType<typeof listClients>) {
  const activeClient = clients.find((client) => client.id === activeClientId);

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)]">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand-deep)]">
          {activeClient?.displayName.slice(0, 1).toUpperCase() ?? "C"}
        </span>
        <span>
          {activeClient?.displayName ?? "Client"} · {activeClient?.petitionType ?? "EB-1A"}
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] shadow-[0_22px_50px_rgba(15,23,42,0.14)]">
        <div className="border-b border-[var(--border-secondary)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Switch client
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}/review`}
              className={`block rounded-[12px] px-3 py-2 text-[11px] transition ${
                client.id === activeClientId
                  ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                  : "text-[var(--foreground)] hover:bg-[var(--paper-secondary)]"
              }`}
            >
              <p className="font-semibold">{client.displayName}</p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {client.petitionType} · {client.status.replaceAll("-", " ")}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}

function buildReviewItem(
  snapshot: LibrarySnapshot,
  document: ClientDocument,
  input: {
    title: string;
    workspaceLabel: string;
    confidence: number;
    reasoning: string;
    shortSummary: string;
    roleHint: ReviewDecisionItem["roleHint"];
    currentCriterionCode: string | null;
    currentCriterionLegalCode: string | null;
    currentCriterionName: string | null;
    currentCriterionRole: ReviewDecisionItem["currentCriterionRole"];
    topLevelBundleId: string | null;
    topLevelBundleName: string | null;
    currentBundleId: string | null;
    currentBundleName: string | null;
    currentParentBundleId: string | null;
  },
): ReviewDecisionItem {
  return {
    id: document.id,
    jobId: document.jobId,
    title: input.title,
    fileName: document.fileName,
    workspaceLabel: input.workspaceLabel,
    confidence: input.confidence,
    reasoning: input.reasoning,
    shortSummary: input.shortSummary,
    roleHint: input.roleHint,
    denseReviewHref: snapshot.activeJobId ? `/review/${snapshot.activeJobId}` : "/",
    previewHref: `/api/documents/${document.id}/preview?jobId=${encodeURIComponent(
      document.jobId,
    )}`,
    sourceHref: `/api/documents/${document.id}/source?jobId=${encodeURIComponent(
      document.jobId,
    )}`,
    reviewStatus: document.reviewStatus,
    currentCriterionCode: input.currentCriterionCode,
    currentCriterionLegalCode: input.currentCriterionLegalCode,
    currentCriterionName: input.currentCriterionName,
    currentCriterionRole: input.currentCriterionRole,
    topLevelBundleId: input.topLevelBundleId,
    topLevelBundleName: input.topLevelBundleName,
    currentBundleId: input.currentBundleId,
    currentBundleName: input.currentBundleName,
    currentParentBundleId: input.currentParentBundleId,
  };
}

function upsertBundleGroup(
  groups: Map<string, ReviewBundleFitGroup>,
  key: string,
  input: Omit<ReviewBundleFitGroup, "itemCount" | "items">,
  item: ReviewDecisionItem,
) {
  const existing =
    groups.get(key) ??
    {
      ...input,
      itemCount: 0,
      items: [],
    };

  existing.items.push(item);
  existing.itemCount += 1;
  groups.set(key, existing);
}

function createReadyBand(
  key: string,
  title: string,
  legalCode: string,
  denseReviewHref: string | null,
): ReviewCategoryBandData {
  return {
    key,
    title,
    legalCode,
    taggedCount: 0,
    note: "These files are fully reviewed and ready for strategy and drafting.",
    decisions: [],
    routine: {
      count: 0,
      samples: [],
      denseReviewHref,
      label: "ready evidence",
    },
  };
}

function buildReviewQueues(
  snapshots: LibrarySnapshot[],
): {
  archiveItems: string[];
  referenceItems: ReviewDecisionItem[];
  fileDecisionItems: ReviewDecisionItem[];
  bundleReviewGroups: ReviewBundleFitGroup[];
  otherBundleGroups: ReviewBundleFitGroup[];
  criterionReviewQueue: ReviewBundleDecisionItem[];
  otherCriterionQueue: ReviewBundleDecisionItem[];
  readyBands: ReviewCategoryBandData[];
  unresolvedFileCount: number;
  unresolvedBundleCount: number;
  unresolvedCriterionCount: number;
  readyCount: number;
} {
  const archiveItems: string[] = [];
  const referenceItems: ReviewDecisionItem[] = [];
  const fileDecisionItems: ReviewDecisionItem[] = [];
  const bundleReviewGroups = new Map<string, ReviewBundleFitGroup>();
  const otherBundleGroups = new Map<string, ReviewBundleFitGroup>();
  const criterionReviewQueue: ReviewBundleDecisionItem[] = [];
  const otherCriterionQueue: ReviewBundleDecisionItem[] = [];
  const readyCategoryMap = new Map<string, ReviewCategoryBandData>();
  let readyCount = 0;

  snapshots.forEach((snapshot) => {
    const standardBundles = (snapshot.eventBundles?.bundles ?? []).filter(
      (bundle) => bundle.bundleKind === "standard",
    );
    const bundleLookup = new Map(standardBundles.map((bundle) => [bundle.id, bundle]));
    const classificationLookup = new Map(
      (snapshot.eb1aClassification?.decisions ?? []).map((decision) => [decision.bundleId, decision]),
    );
    const subBundleLookup = new Map(
      (snapshot.reviewState?.subBundles ?? []).map((subBundle) => [subBundle.id, subBundle]),
    );
    const documentSubBundleLookup = new Map<string, string>();
    const bundleMembership = new Map<
      string,
      {
        acceptedItems: ReviewDecisionItem[];
        pendingCount: number;
      }
    >();
    const documentBundleDecisions = snapshot.reviewState?.documentBundleDecisions ?? {};
    const bundleCriterionDecisions = snapshot.reviewState?.bundleCriterionDecisions ?? {};

    (snapshot.reviewState?.subBundles ?? []).forEach((subBundle) => {
      subBundle.evidenceDocumentIds.forEach((documentId) => {
        documentSubBundleLookup.set(documentId, subBundle.id);
      });
    });

    snapshot.documents.forEach((document) => {
      const criterion = dominantCriterionTag(document);
      const currentSubBundleId = documentSubBundleLookup.get(document.id) ?? null;
      const currentSubBundle = currentSubBundleId
        ? subBundleLookup.get(currentSubBundleId) ?? null
        : null;
      const currentTopLevelBundle =
        currentSubBundle
          ? bundleLookup.get(currentSubBundle.parentBundleId) ?? null
          : standardBundles.find((bundle) => bundle.evidenceDocumentIds.includes(document.id)) ?? null;
      const currentBundleName = currentSubBundle
        ? currentTopLevelBundle
          ? `${currentTopLevelBundle.name} → ${currentSubBundle.name}`
          : currentSubBundle.name
        : currentTopLevelBundle?.name ?? null;
      const title = document.summary?.title ?? document.fileName;
      const reviewItem = buildReviewItem(snapshot, document, {
        title,
        workspaceLabel: snapshot.activeJob?.folderLabel ?? document.folderLabel,
        confidence: criterion?.confidence ?? 1,
        reasoning:
          document.reviewStatusReason ??
          criterion?.reasoning ??
          "Setu could not confidently finalize this evidence without a human decision.",
        shortSummary:
          document.summary?.shortSummary ??
          document.summary?.detailedSummary ??
          "No summary is available yet.",
        roleHint: criterion?.role ?? null,
        currentCriterionCode: criterion?.code ?? null,
        currentCriterionLegalCode: criterion?.legalCode ?? null,
        currentCriterionName: criterion?.name ?? null,
        currentCriterionRole: criterion?.role ?? null,
        topLevelBundleId: currentTopLevelBundle?.id ?? null,
        topLevelBundleName: currentTopLevelBundle?.name ?? null,
        currentBundleId: currentSubBundle?.id ?? currentTopLevelBundle?.id ?? null,
        currentBundleName,
        currentParentBundleId: currentSubBundle?.parentBundleId ?? null,
      });

      if (document.reviewStatus === "archived") {
        archiveItems.push(title);
        return;
      }

      if (document.reviewStatus === "reference") {
        referenceItems.push(reviewItem);
        return;
      }

      if (document.reviewStatus === "pending") {
        fileDecisionItems.push(reviewItem);
        return;
      }

      if (document.reviewStatus !== "kept") {
        return;
      }

      const bundleDecision = documentBundleDecisions[document.id] ?? null;
      const displayBundleId = reviewItem.currentBundleId ?? `unassigned:${document.id}`;
      const displayBundleName = reviewItem.currentBundleName ?? "Bundle review needed";
      const groupInput = {
        key: `${snapshot.activeJobId}:${displayBundleId}`,
        jobId: document.jobId,
        workspaceLabel: reviewItem.workspaceLabel,
        bundleId: reviewItem.currentBundleId,
        bundleName: displayBundleName,
      };

      if (!bundleDecision) {
        upsertBundleGroup(bundleReviewGroups, groupInput.key, groupInput, reviewItem);
      } else if (bundleDecision.status === "other") {
        upsertBundleGroup(
          otherBundleGroups,
          `${snapshot.activeJobId}:other-bundle`,
          {
            key: `${snapshot.activeJobId}:other-bundle`,
            jobId: document.jobId,
            workspaceLabel: reviewItem.workspaceLabel,
            bundleId: null,
            bundleName: "Other bundle",
          },
          reviewItem,
        );
      }

      const topLevelBundleId = reviewItem.topLevelBundleId;

      if (topLevelBundleId) {
        const membership =
          bundleMembership.get(topLevelBundleId) ?? {
            acceptedItems: [],
            pendingCount: 0,
          };

        if (!bundleDecision) {
          membership.pendingCount += 1;
        } else if (bundleDecision.status === "accepted") {
          membership.acceptedItems.push(reviewItem);
        }

        bundleMembership.set(topLevelBundleId, membership);
      }
    });

    standardBundles.forEach((bundle) => {
      const membership = bundleMembership.get(bundle.id);

      if (!membership || membership.acceptedItems.length === 0 || membership.pendingCount > 0) {
        return;
      }

      const decision = classificationLookup.get(bundle.id);
      const criterionDecision = bundleCriterionDecisions[bundle.id] ?? null;
      const bundleItem: ReviewBundleDecisionItem = {
        id: bundle.id,
        jobId: bundle.jobId,
        bundleName: bundle.name,
        workspaceLabel: snapshot.activeJob?.folderLabel ?? "Workspace",
        rationale:
          decision?.unclassifiedReason ??
          decision?.rationale ??
          "Setu needs a human criterion call on this bundle.",
        denseReviewHref: snapshot.activeJobId ? `/review/${snapshot.activeJobId}` : "/",
        criterionHint: decision?.primaryCriterionName ?? null,
        criterionCode: decision?.primaryCriterionCode ?? null,
        documentCount: membership.acceptedItems.length,
        bucketCode: decision?.bucketCode ?? null,
      };

      if (
        criterionDecision?.status === "other" ||
        (!criterionDecision && decision?.bucketCode === OTHER_REVIEW_BUCKET_CODE)
      ) {
        otherCriterionQueue.push(bundleItem);
        return;
      }

      if (criterionDecision?.status === "accepted" && decision?.primaryCriterionCode) {
        const criterionDefinition = EB1A_CRITERIA_DEFINITIONS.find(
          (criterion) => criterion.code === decision.primaryCriterionCode,
        );
        const band =
          readyCategoryMap.get(decision.primaryCriterionCode) ??
          createReadyBand(
            decision.primaryCriterionCode,
            criterionDefinition?.name ?? decision.primaryCriterionName ?? "Criterion",
            criterionDefinition?.legalCode ?? decision.primaryCriterionCode,
            snapshot.activeJobId ? `/review/${snapshot.activeJobId}` : null,
          );

        readyCount += membership.acceptedItems.length;
        band.taggedCount += membership.acceptedItems.length;
        band.routine = {
          count: (band.routine?.count ?? 0) + membership.acceptedItems.length,
          samples: [
            ...(band.routine?.samples ?? []),
            ...membership.acceptedItems.map((item) => item.title),
          ].slice(0, 4),
          denseReviewHref: band.routine?.denseReviewHref ?? null,
          label: "ready evidence",
        };
        readyCategoryMap.set(decision.primaryCriterionCode, band);
        return;
      }

      criterionReviewQueue.push(bundleItem);
    });
  });

  return {
    archiveItems,
    referenceItems,
    fileDecisionItems,
    bundleReviewGroups: Array.from(bundleReviewGroups.values()).sort((left, right) =>
      left.bundleName.localeCompare(right.bundleName),
    ),
    otherBundleGroups: Array.from(otherBundleGroups.values()).sort((left, right) =>
      left.workspaceLabel.localeCompare(right.workspaceLabel),
    ),
    criterionReviewQueue: criterionReviewQueue.sort((left, right) =>
      left.bundleName.localeCompare(right.bundleName),
    ),
    otherCriterionQueue: otherCriterionQueue.sort((left, right) =>
      left.bundleName.localeCompare(right.bundleName),
    ),
    readyBands: Array.from(readyCategoryMap.values()).sort((left, right) =>
      left.legalCode.localeCompare(right.legalCode),
    ),
    unresolvedFileCount: fileDecisionItems.length,
    unresolvedBundleCount: Array.from(bundleReviewGroups.values()).reduce(
      (sum, group) => sum + group.items.length,
      0,
    ),
    unresolvedCriterionCount: criterionReviewQueue.length,
    readyCount,
  };
}

export default async function ClientReviewPage({ params }: ClientReviewPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }
  const jobs = listClientJobs(clientId);
  const snapshots = await Promise.all(
    jobs.map((job) => buildLibrarySnapshot({ jobId: job.id, clientId })),
  );

  snapshots.forEach((snapshot) => {
    if (snapshot.activeJob && isWorkspaceReady(snapshot)) {
      ensureClientTimelineEvent({
        id: `${snapshot.activeJob.id}:pipeline-completed`,
        clientId,
        occurredAt:
          snapshot.activeJob.completedAt ??
          snapshot.criteriaTagging?.updatedAt ??
          snapshot.activeJob.createdAt,
        kind: "pipeline-completed",
        workspaceId: snapshot.activeJob.id,
        summary: `Workspace '${snapshot.activeJob.folderLabel}' reached Ready.`,
        metadata: {
          workspaceId: snapshot.activeJob.id,
          workspaceStatus: snapshot.activeJob.status,
        },
      });
    }
  });

  const reviewQueues = buildReviewQueues(snapshots);

  const derivedStatus = deriveClientStatus({
    clientStatus: client.status,
    lockedStrategyVersion: client.lockedStrategyVersion,
    snapshots,
    unresolvedFileCount: reviewQueues.unresolvedFileCount,
    unresolvedBundleCount: reviewQueues.unresolvedBundleCount,
    unresolvedCriterionCount: reviewQueues.unresolvedCriterionCount,
  });

  const syncedClient =
    client.status !== derivedStatus ? updateClient(clientId, { status: derivedStatus }) ?? client : client;

  if (derivedStatus === "strategizing") {
    ensureClientTimelineEvent({
      id: `${clientId}:review-completed`,
      clientId,
      occurredAt: new Date().toISOString(),
      kind: "review-completed",
      workspaceId: null,
      summary: "All review action items have been resolved.",
      metadata: {
        clientId,
      },
    });
  }

  const clients = listClients();

  const denseWorkbenchHref = snapshots[0]?.activeJobId ? `/review/${snapshots[0].activeJobId}` : null;
  const workspaceContexts = snapshots
    .map((snapshot) => buildWorkspaceContext(snapshot))
    .filter((entry): entry is ReviewWorkspaceContext => Boolean(entry));
  const taggedCount = snapshots.flatMap((snapshot) => snapshot.documents).filter(
    (document) => document.criteriaTags.length > 0,
  ).length;
  const routineCount = reviewQueues.readyCount;

  const strategyHref = `/clients/${clientId}/strategy`;
  const summaryStateKey = JSON.stringify({
    files: reviewQueues.fileDecisionItems.map((item) => item.id),
    bundleGroups: reviewQueues.bundleReviewGroups.map((group) => ({
      key: group.key,
      itemIds: group.items.map((item) => item.id),
    })),
    criterionQueue: reviewQueues.criterionReviewQueue.map((item) => item.id),
    readyBands: reviewQueues.readyBands.map((band) => ({
      key: band.key,
      tagged: band.taggedCount,
    })),
    otherBundleGroups: reviewQueues.otherBundleGroups.map((group) => ({
      key: group.key,
      itemIds: group.items.map((item) => item.id),
    })),
    otherCriterionQueue: reviewQueues.otherCriterionQueue.map((item) => item.id),
    reference: reviewQueues.referenceItems.map((item) => item.id),
    archiveCount: reviewQueues.archiveItems.length,
  });

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1540px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <SetuHomeLink />
                {buildClientSwitcher(clientId, clients)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {denseWorkbenchHref ? (
                <Link
                  href={denseWorkbenchHref}
                  className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
                >
                  Dense workbench
                </Link>
              ) : null}
              <Link
                href={`/?view=workspace&clientId=${clientId}`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Workspace intake
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-2 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-3">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Stages
            </p>
            {[
              { number: 1, label: "Onboarding", state: "done" },
              {
                number: 2,
                label: "Review",
                state: "active",
              },
              {
                number: 3,
                label: "Strategy",
                state:
                  derivedStatus === "strategizing" || derivedStatus === "locked"
                      ? "done"
                      : getClientStageNumber(derivedStatus) > 2
                        ? "done"
                        : "locked",
              },
              {
                number: 4,
                label: "Lock",
                state: derivedStatus === "locked" ? "done" : "locked",
              },
              {
                number: 5,
                label: "Drafting",
                state: derivedStatus === "locked" ? "active" : "locked",
              },
              { number: 6, label: "Synthesis", state: "locked" },
              { number: 7, label: "Stitching", state: "locked" },
            ].map((stage) => (
              <div
                key={stage.number}
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[12px] ${
                  stage.state === "active"
                    ? "bg-[var(--brand-charcoal)] text-white"
                    : stage.state === "done"
                      ? "bg-[var(--paper-secondary)] text-[var(--foreground)]"
                      : "bg-[var(--paper-tertiary)] text-[var(--muted)]"
                }`}
                title={stage.state === "locked" ? "Available in a later phase." : undefined}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                    stage.state === "active"
                      ? "bg-[var(--brand)] text-[var(--brand-charcoal-deep)]"
                      : "bg-[var(--paper-primary)]"
                  }`}
                >
                  {stage.number}
                </span>
                <span>{stage.label}</span>
              </div>
            ))}
          </aside>

          <main className="space-y-5">
            <section className="rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Human review
                  </p>
                  <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    Human review
                  </h1>
                  <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
                    A real case can carry hundreds of files. Setu gives you four review modes so
                    you can triage quickly, inspect in detail, and still preserve the file → bundle
                    → criterion sequence without losing held-later work.
                  </p>
                </div>
                <span className="self-start rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)] lg:ml-auto">
                  {reviewQueues.unresolvedFileCount +
                    reviewQueues.unresolvedBundleCount +
                    reviewQueues.unresolvedCriterionCount}{" "}
                  next-step actions open
                </span>
              </div>
              {derivedStatus === "onboarding" ? (
                <div className="mt-4 rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3 text-[11px] leading-6 text-[var(--brand-deep)]">
                  Onboarding is still running for this client. Setu is surfacing the review items
                  that are already available, but the final review queue may still grow until the
                  current workspace reaches Ready.
                </div>
              ) : null}
            </section>

            <ActionItemsSummary
              key={summaryStateKey}
              clientId={clientId}
              clientName={syncedClient.displayName}
              totalTagged={taggedCount}
              initialRoutineCount={routineCount}
              initialArchiveCount={reviewQueues.archiveItems.length}
              initialReferenceItems={reviewQueues.referenceItems}
              workspaceContexts={workspaceContexts}
              readyBands={reviewQueues.readyBands}
              fileDecisionItems={reviewQueues.fileDecisionItems}
              bundleReviewGroups={reviewQueues.bundleReviewGroups}
              otherBundleGroups={reviewQueues.otherBundleGroups}
              criterionReviewQueue={reviewQueues.criterionReviewQueue}
              otherCriterionQueue={reviewQueues.otherCriterionQueue}
              archiveSamples={reviewQueues.archiveItems.slice(0, 4)}
              archiveReviewHref={denseWorkbenchHref}
              strategyHref={strategyHref}
              denseWorkbenchHref={denseWorkbenchHref}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
