import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ActionItemsSummary,
  type ReviewBundleDecisionItem,
  type ReviewCategoryBandData,
} from "@/components/review/ActionItemsSummary";
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

function isDecisionDocument(document: ClientDocument) {
  return (
    document.reviewStatus === "pending" ||
    document.criteriaTags.some((tag) => tag.confidence < 0.65)
  );
}

function dominantCriterionTag(document: ClientDocument) {
  const primary = document.criteriaTags.filter((tag) => tag.role === "primary");
  const pool = primary.length ? primary : document.criteriaTags;

  return [...pool].sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function deriveClientStatus(input: {
  clientStatus: ClientStatus;
  lockedStrategyVersion: number | null;
  snapshots: LibrarySnapshot[];
  documents: ClientDocument[];
  bundleReviewCount: number;
}) {
  if (input.clientStatus === "locked" || input.lockedStrategyVersion !== null) {
    return "locked" satisfies ClientStatus;
  }

  const allReady =
    input.snapshots.length > 0 && input.snapshots.every((snapshot) => isWorkspaceReady(snapshot));

  if (!allReady) {
    return "onboarding" satisfies ClientStatus;
  }

  const openDocumentDecisions = input.documents.filter((document) => isDecisionDocument(document));

  if (openDocumentDecisions.length > 0 || input.bundleReviewCount > 0) {
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

  const allDocuments = snapshots.flatMap((snapshot) => snapshot.documents);
  const bundleReviewCount = snapshots.reduce((sum, snapshot) => {
    const decisions = snapshot.eb1aClassification?.decisions ?? [];
    return (
      sum +
      decisions.filter(
        (decision) =>
          decision.bucketKind === "human_review" ||
          decision.bucketCode === "REVIEW" ||
          decision.reviewDisposition === "unclassified",
      ).length
    );
  }, 0);

  const derivedStatus = deriveClientStatus({
    clientStatus: client.status,
    lockedStrategyVersion: client.lockedStrategyVersion,
    snapshots,
    documents: allDocuments,
    bundleReviewCount,
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

  const categoryMap = new Map<string, ReviewCategoryBandData>();
  const archiveItems: string[] = [];
  const denseWorkbenchHref = snapshots[0]?.activeJobId ? `/review/${snapshots[0].activeJobId}` : null;

  snapshots.forEach((snapshot) => {
    snapshot.documents.forEach((document) => {
      if (document.reviewStatus === "archived") {
        archiveItems.push(document.summary?.title ?? document.fileName);
      }

      const criterion = dominantCriterionTag(document);

      if (!criterion) {
        return;
      }

      const key = criterion.code;
      const band =
        categoryMap.get(key) ??
        {
          key,
          legalCode: criterion.legalCode,
          title: criterion.name,
          taggedCount: 0,
          decisions: [],
          routine: {
            count: 0,
            samples: [],
            denseReviewHref: snapshot.activeJobId ? `/review/${snapshot.activeJobId}` : null,
            label: "routine Keep",
          },
        };

      band.taggedCount += 1;

      if (document.reviewStatus !== "archived" && isDecisionDocument(document)) {
        band.decisions.push({
          id: document.id,
          jobId: document.jobId,
          title: document.summary?.title ?? document.fileName,
          fileName: document.fileName,
          workspaceLabel: snapshot.activeJob?.folderLabel ?? document.folderLabel,
          confidence: criterion.confidence,
          reasoning:
            document.reviewStatusReason ??
            criterion.reasoning ??
            "Setu could not confidently finalize this document without a human decision.",
          shortSummary:
            document.summary?.shortSummary ??
            document.summary?.detailedSummary ??
            "No summary is available yet.",
          roleHint: criterion.role,
          denseReviewHref: snapshot.activeJobId ? `/review/${snapshot.activeJobId}` : "/",
          previewHref: `/api/documents/${document.id}/preview?jobId=${encodeURIComponent(
            document.jobId,
          )}`,
          sourceHref: `/api/documents/${document.id}/source?jobId=${encodeURIComponent(
            document.jobId,
          )}`,
        });
      } else if (document.reviewStatus === "kept") {
        band.routine = {
          count: (band.routine?.count ?? 0) + 1,
          samples: [
            ...(band.routine?.samples ?? []),
            document.summary?.title ?? document.fileName,
          ].slice(0, 4),
          denseReviewHref: band.routine?.denseReviewHref ?? null,
          label: "routine Keep",
        };
      }

      categoryMap.set(key, band);
    });
  });

  const bands = [...categoryMap.values()].sort((left, right) =>
    left.legalCode.localeCompare(right.legalCode),
  );
  const taggedCount = allDocuments.filter((document) => document.criteriaTags.length > 0).length;
  const routineCount = allDocuments.filter(
    (document) =>
      document.criteriaTags.length > 0 &&
      document.reviewStatus === "kept" &&
      !document.criteriaTags.some((tag) => tag.confidence < 0.65),
  ).length;

  const humanReviewQueue: ReviewBundleDecisionItem[] = snapshots.flatMap((snapshot) => {
    const decisions = snapshot.eb1aClassification?.decisions ?? [];
    const bundleLookup = new Map(
      (snapshot.eventBundles?.bundles ?? []).map((bundle) => [bundle.id, bundle]),
    );

    return decisions
      .filter(
        (decision) =>
          decision.bucketKind === "human_review" ||
          decision.bucketCode === "REVIEW" ||
          decision.reviewDisposition === "unclassified",
      )
      .map((decision) => ({
        id: decision.bundleId,
        bundleName:
          bundleLookup.get(decision.bundleId)?.name ?? decision.suggestedExhibitTitle,
        workspaceLabel: snapshot.activeJob?.folderLabel ?? "Workspace",
        rationale:
          decision.unclassifiedReason ??
          decision.rationale ??
          "Setu could not confidently assign this bundle to a criterion.",
        denseReviewHref: snapshot.activeJobId ? `/review/${snapshot.activeJobId}` : "/",
        criterionHint: decision.primaryCriterionName,
      }));
  });

  const strategyHref = `/clients/${clientId}/strategy`;

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1540px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <span className="setu-wordmark" aria-label="setu">
                  <span className="setu-wordmark-letters">setu</span>
                  <span className="setu-wordmark-deck" aria-hidden="true" />
                </span>
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
                state:
                  derivedStatus === "locked"
                    ? "done"
                    :
                  derivedStatus === "reviewing"
                    ? "active"
                    : getClientStageNumber(derivedStatus) > 2
                      ? "done"
                      : "active",
              },
              {
                number: 3,
                label: "Strategy",
                state:
                  derivedStatus === "strategizing"
                    ? "active"
                    : derivedStatus === "locked"
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
              { number: 6, label: "Stitching", state: "locked" },
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
                    Review the few items the AI could not settle on its own
                  </h1>
                  <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
                    Setu keeps the routine work collapsed into category bands and leaves the
                    ambiguous items at the top so a document specialist can review the case in
                    manageable increments.
                  </p>
                </div>
                <span className="self-start rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)] lg:ml-auto">
                  {bands.reduce((sum, band) => sum + band.decisions.length, 0) +
                    humanReviewQueue.length}{" "}
                  decisions open
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
              clientId={clientId}
              clientName={syncedClient.displayName}
              totalTagged={taggedCount}
              initialRoutineCount={routineCount}
              initialArchiveCount={archiveItems.length}
              bands={bands}
              humanReviewQueue={humanReviewQueue}
              archiveSamples={archiveItems.slice(0, 4)}
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
