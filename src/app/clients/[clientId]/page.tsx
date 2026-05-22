import Link from "next/link";
import { notFound } from "next/navigation";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { BlockingActionCard } from "@/components/client-home/BlockingActionCard";
import { ClientHero } from "@/components/client-home/ClientHero";
import { CoverageCard } from "@/components/client-home/CoverageCard";
import { PipelineStrip } from "@/components/client-home/PipelineStrip";
import { SpendCard } from "@/components/client-home/SpendCard";
import { StageTile } from "@/components/client-home/StageTile";
import { TimelineCard } from "@/components/client-home/TimelineCard";
import { deriveDocumentDisposition, normalizeCriterionTags } from "@/lib/criterion-tags";
import { buildWorkspaceCoverage } from "@/lib/coverage";
import {
  getClient,
  getClientStageNumber,
  getSynthesisLifecycleStatus,
  listClientJobs,
  listClients,
  updateClient,
} from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { buildLibrarySnapshot } from "@/lib/library";
import { getLockedStrategy } from "@/lib/lock";
import { listSynthesisDrafts } from "@/lib/synthesis";
import { ensureClientTimelineEvent, listClientTimeline } from "@/lib/timeline";
import type {
  ClientDocument,
  ClientStatus,
  LibrarySnapshot,
  WorkspaceCoverage,
} from "@/lib/types";

interface ClientHomePageProps {
  params: Promise<{
    clientId: string;
  }>;
}

function formatCalendarDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const now = Date.now();
  const diffMs = now - new Date(value).getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
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
    deriveDocumentDisposition(document) === "untouched" ||
    normalizeCriterionTags(document).some(
      (tag) => tag.state === "suggested" || (tag.aiConfidence ?? tag.confidence) < 0.65,
    )
  );
}

function deriveClientStatus(input: {
  clientStatus: ClientStatus;
  lockedStrategyVersion: number | null;
  snapshots: LibrarySnapshot[];
  documents: ClientDocument[];
  bundleReviewCount: number;
  claimedCriteriaCount: number;
  generatedDraftCount: number;
  approvedDraftCount: number;
  approvedSynthesisCount: number;
}) {
  if (
    input.clientStatus === "locked" ||
    input.clientStatus === "drafting" ||
    input.clientStatus === "synthesizing" ||
    input.clientStatus === "stitching" ||
    input.lockedStrategyVersion !== null
  ) {
    if (input.claimedCriteriaCount > 0 && input.approvedDraftCount >= input.claimedCriteriaCount) {
      return getSynthesisLifecycleStatus({
        locked: true,
        claimedCriteriaCount: input.claimedCriteriaCount,
        approvedCriteriaCount: input.approvedDraftCount,
        approvedSynthesisCount: input.approvedSynthesisCount,
      });
    }
    if (input.generatedDraftCount > 0) {
      return "drafting" satisfies ClientStatus;
    }
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

function statusLabel(status: ClientStatus) {
  const stageNumber = getClientStageNumber(status);
  const readable =
    status === "onboarding"
      ? "In progress"
      : status === "reviewing"
        ? "Review in progress"
        : status === "strategizing"
          ? "Ready for strategy"
          : status.replaceAll("-", " ");

  return `${readable} · Stage ${stageNumber}`;
}

function summarizeCoverage(coverage: WorkspaceCoverage | null) {
  if (!coverage) {
    return {
      strongText: "Coverage will appear here after tagging completes.",
      partialText: "No partial criteria yet",
    };
  }

  const strong = coverage.criteria.filter((criterion) => criterion.state === "strong");
  const partial = coverage.criteria.filter((criterion) => criterion.state === "partial");

  return {
    strongText: strong.length
      ? strong.map((criterion) => criterion.name).join(", ")
      : "No strong criteria yet",
    partialText: partial.length
      ? partial.map((criterion) => criterion.name).join(", ")
      : "No partial criteria",
  };
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
              href={`/clients/${client.id}`}
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

export default async function ClientHomePage({ params }: ClientHomePageProps) {
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
  const aggregateCoverage = buildWorkspaceCoverage(allDocuments);
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
  const lockedStrategy = getLockedStrategy(clientId);
  const claimedCriteriaCount = [
    ...(lockedStrategy?.primary ?? []),
    ...(lockedStrategy?.supporting ?? []),
  ].length;
  const drafts = listCriterionDrafts(clientId);
  const generatedDraftCount = drafts.filter((draft) => draft.versions.length > 0).length;
  const approvedDraftCount = drafts.filter((draft) => draft.latestApprovedVersion !== null).length;
  const approvedSynthesisCount = listSynthesisDrafts(clientId).filter(
    (draft) => draft.latestApprovedVersion !== null,
  ).length;

  const derivedStatus = deriveClientStatus({
    clientStatus: client.status,
    lockedStrategyVersion: client.lockedStrategyVersion,
    snapshots,
    documents: allDocuments,
    bundleReviewCount,
    claimedCriteriaCount,
    generatedDraftCount,
    approvedDraftCount,
    approvedSynthesisCount,
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
  const timeline = listClientTimeline(clientId).slice(0, 5);
  const readyWorkspaceCount = snapshots.filter((snapshot) => isWorkspaceReady(snapshot)).length;
  const routineDocumentCount = allDocuments.filter(
    (document) =>
      deriveDocumentDisposition(document) === "tagged" &&
      normalizeCriterionTags(document).some((tag) => tag.state === "enabled") &&
      !normalizeCriterionTags(document).some(
        (tag) => tag.state === "suggested" || (tag.aiConfidence ?? tag.confidence) < 0.65,
      ),
  ).length;
  const archivedDocumentCount = allDocuments.filter(
    (document) => deriveDocumentDisposition(document) === "archived",
  ).length;
  const openDecisionCount = allDocuments.filter((document) => isDecisionDocument(document)).length;
  const totalDocuments = allDocuments.length;
  const stageNumber = getClientStageNumber(derivedStatus);
  const reviewHref = `/clients/${clientId}/review`;
  const strategyHref = `/clients/${clientId}/strategy`;
  const lockHref = `/clients/${clientId}/lock`;
  const draftingHref = `/clients/${clientId}/drafting`;
  const synthesisHref = `/clients/${clientId}/synthesis`;
  const stitchingHref = `/clients/${clientId}/stitching`;
  const workspaceHref = `/?view=workspace&clientId=${clientId}`;
  const denseWorkbenchHref = snapshots[0]?.activeJobId ? `/review/${snapshots[0].activeJobId}` : null;
  const coverageSummary = summarizeCoverage(aggregateCoverage);
  const petitionSummary = `EB-1A petition · ${jobs.length} workspace${
    jobs.length === 1 ? "" : "s"
  } · ${totalDocuments} document${totalDocuments === 1 ? "" : "s"} · ${
    derivedStatus === "onboarding"
      ? "onboarding in progress"
      : derivedStatus === "reviewing"
        ? "human review in progress"
        : derivedStatus === "locked"
          ? "case theory locked"
        : derivedStatus === "drafting"
          ? "criterion drafting in progress"
          : derivedStatus === "synthesizing"
            ? "synthesis in progress"
          : derivedStatus === "stitching"
            ? "packet assembly in progress"
        : "strategy workspace ready"
  }`;

  const spendItems = [
    {
      label: "Indexing",
      value: allDocuments.reduce(
        (sum, document) => sum + (document.usage?.embedding?.costUsd ?? 0),
        0,
      ),
    },
    {
      label: "Summaries",
      value: allDocuments.reduce(
        (sum, document) => sum + (document.usage?.summary?.costUsd ?? 0),
        0,
      ),
    },
    {
      label: "Bundling",
      value: snapshots.reduce(
        (sum, snapshot) => sum + (snapshot.eventBundles?.totalCostUsd ?? 0),
        0,
      ),
    },
    {
      label: "Classifying",
      value: snapshots.reduce(
        (sum, snapshot) => sum + (snapshot.eb1aClassification?.totalCostUsd ?? 0),
        0,
      ),
    },
    {
      label: "Tagging",
      value: snapshots.reduce(
        (sum, snapshot) => sum + (snapshot.criteriaTagging?.totalCostUsd ?? 0),
        0,
      ),
    },
  ];

  const blockingAction =
    derivedStatus === "onboarding"
      ? {
          title: "Next: finish onboarding",
          body: `Setu is still preparing at least one workspace. ${readyWorkspaceCount} of ${jobs.length} workspace${
            jobs.length === 1 ? "" : "s"
          } are ready for review.`,
          ctaLabel: "Open onboarding",
          href: workspaceHref,
        }
      : derivedStatus === "reviewing"
        ? {
            title: `Next: resolve ${openDecisionCount + bundleReviewCount} review decision${
              openDecisionCount + bundleReviewCount === 1 ? "" : "s"
            }`,
            body: "Setu collapsed the routine work. Open the review surface to handle the remaining document and bundle decisions.",
            ctaLabel: "Open review",
            href: reviewHref,
          }
        : derivedStatus === "locked"
          ? {
              title: "Next: start criterion drafting",
              body: "The criteria mix and anchor exhibits are committed. Open the drafting workspace to generate and approve per-criterion arguments.",
              ctaLabel: "Continue to Drafting",
              href: draftingHref,
            }
        : derivedStatus === "drafting"
          ? {
              title: `Next: finish ${Math.max(claimedCriteriaCount - approvedDraftCount, 0)} criterion draft${
                claimedCriteriaCount - approvedDraftCount === 1 ? "" : "s"
              }`,
              body: "Setu keeps approved drafts frozen while in-progress criteria remain editable. Continue drafting until every claimed criterion is approved.",
              ctaLabel: "Open drafting",
              href: draftingHref,
            }
        : derivedStatus === "synthesizing"
          ? {
              title: `Next: finalize ${Math.max(2 - approvedSynthesisCount, 0)} synthesis section${
                Math.max(2 - approvedSynthesisCount, 0) === 1 ? "" : "s"
              }`,
              body: "The criterion arguments are approved. Draft and approve the Statement of Eligibility and Final Merits Determination before packet assembly.",
              ctaLabel: "Open synthesis",
              href: synthesisHref,
            }
        : derivedStatus === "stitching"
          ? {
              title: "Next: assemble the filing packet",
              body: "Setu now has the locked theory, approved criterion drafts, and approved synthesis sections. Open stitching to audit the record and export the packet PDF.",
              ctaLabel: "Open stitching",
              href: stitchingHref,
            }
        : {
            title: "Next: open strategy",
            body: "Review is complete. Open the client-wide strategy stage to inspect coverage, generate the case theory, and stress-test the lead argument.",
            ctaLabel: "Open strategy",
            href: strategyHref,
          };

  const stageTiles = [
    {
      number: 1,
      title: "Onboarding",
      description: `${jobs.length} workspace${jobs.length === 1 ? "" : "s"} · ${readyWorkspaceCount}/${jobs.length} ready · ${totalDocuments} document${totalDocuments === 1 ? "" : "s"}`,
      state:
        derivedStatus === "onboarding"
          ? ("active" as const)
          : ("done" as const),
      href: workspaceHref,
      badge: derivedStatus === "onboarding" ? "In progress" : "Complete",
    },
    {
      number: 2,
      title: "Human review",
      description: `${routineDocumentCount} routine Keep · ${archivedDocumentCount} archived · ${openDecisionCount + bundleReviewCount} still need attention`,
      state:
        derivedStatus === "reviewing"
          ? ("active" as const)
          : stageNumber > 2
            ? ("done" as const)
            : ("locked" as const),
      href: stageNumber >= 2 ? reviewHref : null,
      badge:
        derivedStatus === "reviewing"
          ? "Active"
          : stageNumber > 2
            ? "Complete"
            : "Waiting",
      disabledReason: stageNumber < 2 ? "Available after onboarding completes." : undefined,
    },
    {
      number: 3,
      title: "Strategy",
      description:
        "Read the full client record, generate the memo, ask follow-up questions, and stress-test the case theory.",
      state:
        derivedStatus === "strategizing"
          ? ("active" as const)
          : derivedStatus === "locked" ||
              derivedStatus === "drafting" ||
              derivedStatus === "synthesizing" ||
              derivedStatus === "stitching"
            ? ("done" as const)
          : getClientStageNumber(derivedStatus) > 3
            ? ("done" as const)
            : ("locked" as const),
      href:
        derivedStatus === "strategizing" ||
        derivedStatus === "locked" ||
        derivedStatus === "drafting" ||
        derivedStatus === "synthesizing" ||
        derivedStatus === "stitching"
          ? strategyHref
          : null,
      badge:
        derivedStatus === "strategizing"
          ? "Ready"
          : derivedStatus === "locked" ||
              derivedStatus === "drafting" ||
              derivedStatus === "synthesizing" ||
              derivedStatus === "stitching"
            ? "Locked"
            : "Waiting",
      disabledReason:
        derivedStatus !== "strategizing" &&
        derivedStatus !== "locked" &&
        derivedStatus !== "drafting" &&
        derivedStatus !== "synthesizing" &&
        derivedStatus !== "stitching"
          ? "Resolve onboarding and review requirements before opening strategy."
          : undefined,
    },
    {
      number: 4,
      title: "Lock",
      description: "Commit the final criterion mix and supporting exhibits.",
      state:
        derivedStatus === "locked" ||
        derivedStatus === "drafting" ||
        derivedStatus === "synthesizing" ||
        derivedStatus === "stitching"
          ? ("done" as const)
          : getClientStageNumber(derivedStatus) > 4
            ? ("done" as const)
            : ("locked" as const),
      href:
        derivedStatus === "locked" ||
        derivedStatus === "drafting" ||
        derivedStatus === "synthesizing" ||
        derivedStatus === "stitching"
          ? lockHref
          : null,
      badge:
        derivedStatus === "locked" ||
        derivedStatus === "drafting" ||
        derivedStatus === "synthesizing" ||
        derivedStatus === "stitching"
          ? "Complete"
          : "Later",
      disabledReason:
        derivedStatus !== "locked" &&
        derivedStatus !== "drafting" &&
        derivedStatus !== "synthesizing" &&
        derivedStatus !== "stitching"
          ? "Available after the strategy stage commits the case theory."
          : undefined,
    },
    {
      number: 5,
      title: "Drafting",
      description: "Draft per-criterion arguments after the case theory is locked.",
      state:
        derivedStatus === "locked" || derivedStatus === "drafting"
          ? ("active" as const)
          : derivedStatus === "synthesizing" || derivedStatus === "stitching"
            ? ("done" as const)
            : ("locked" as const),
      href:
        derivedStatus === "locked" ||
        derivedStatus === "drafting" ||
        derivedStatus === "synthesizing" ||
        derivedStatus === "stitching"
          ? draftingHref
          : null,
      badge:
        derivedStatus === "locked"
          ? "Ready next"
          : derivedStatus === "drafting"
            ? "Active"
            : derivedStatus === "synthesizing" || derivedStatus === "stitching"
              ? "Complete"
              : "Later",
      disabledReason:
        derivedStatus === "locked"
          ? "Drafting is now unlocked."
          : "Available after the case theory is locked.",
    },
    {
      number: 6,
      title: "Synthesis",
      description:
        "Draft and approve the Statement of Eligibility and Final Merits Determination.",
      state:
        derivedStatus === "synthesizing"
          ? ("active" as const)
          : derivedStatus === "stitching"
            ? ("done" as const)
            : ("locked" as const),
      href:
        derivedStatus === "synthesizing" || derivedStatus === "stitching"
          ? synthesisHref
          : null,
      badge:
        derivedStatus === "synthesizing"
          ? "Active"
          : derivedStatus === "stitching"
            ? "Complete"
            : "Later",
      disabledReason:
        derivedStatus === "synthesizing" || derivedStatus === "stitching"
          ? undefined
          : "Available after every claimed criterion draft is approved.",
    },
    {
      number: 7,
      title: "Stitching",
      description: "Assemble the full petition packet, exhibits, and export package.",
      state: derivedStatus === "stitching" ? ("active" as const) : ("locked" as const),
      href: derivedStatus === "stitching" ? stitchingHref : null,
      badge: derivedStatus === "stitching" ? "Active" : "Later",
      disabledReason:
        derivedStatus === "stitching"
          ? undefined
          : "Available after both synthesis sections are approved.",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1480px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <SetuHomeLink />
                {buildClientSwitcher(clientId, clients)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={workspaceHref}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Workspace intake
              </Link>
              {denseWorkbenchHref ? (
                <Link
                  href={strategyHref}
                  className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
                >
                  Strategy
                </Link>
              ) : null}
              <Link
                href="/clients"
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                All clients
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 space-y-5 rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <ClientHero
            displayName={syncedClient.displayName}
            petitionSummary={petitionSummary}
            statusLabel={statusLabel(derivedStatus)}
            filingTargetLabel={formatCalendarDate(syncedClient.filingTargetDate)}
          />
          <PipelineStrip currentStage={stageNumber} />
          <BlockingActionCard
            title={blockingAction.title}
            body={blockingAction.body}
            ctaLabel={blockingAction.ctaLabel}
            href={blockingAction.href}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_360px]">
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Stages
              </p>
              {stageTiles.map((stage) => (
                <StageTile key={stage.number} {...stage} />
              ))}
            </div>

            <aside className="space-y-4">
              <CoverageCard coverage={aggregateCoverage} />
              <SpendCard items={spendItems} />
              <TimelineCard
                events={timeline.map((event) => ({
                  id: event.id,
                  whenLabel: formatRelativeTime(event.occurredAt),
                  summary: event.summary,
                }))}
              />
              <div className="setu-panel rounded-[18px] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  At a glance
                </p>
                <div className="mt-3 space-y-2 text-[12px] leading-6 text-[var(--muted)]">
                  <p>{coverageSummary.strongText}</p>
                  <p>{coverageSummary.partialText}</p>
                  <p>
                    {openDecisionCount + bundleReviewCount} review item
                    {openDecisionCount + bundleReviewCount === 1 ? "" : "s"} still require
                    attention.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
