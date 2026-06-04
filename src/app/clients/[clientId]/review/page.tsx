import Link from "next/link";
import { notFound } from "next/navigation";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { EvidenceGrid } from "@/components/review/EvidenceGrid";
import { PreliminaryStrategyPanel } from "@/components/review/PreliminaryStrategyPanel";
import { ReviewDecisionLedger } from "@/components/review/ReviewDecisionLedger";
import { getClient, getClientStageNumber, listClientJobs, listClients, updateClient } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { ensureClientTimelineEvent, listClientTimeline } from "@/lib/timeline";
import type { ClientStatus, LibrarySnapshot } from "@/lib/types";
import { queryClientEvidence } from "@/lib/evidence-query";
import { buildPreliminaryStrategyGuidance } from "@/lib/preliminary-strategy";

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

function deriveClientStatus(input: {
  clientStatus: ClientStatus;
  lockedStrategyVersion: number | null;
  snapshots: LibrarySnapshot[];
  needsAttentionCount: number;
}) {
  if (input.clientStatus === "locked" || input.lockedStrategyVersion !== null) {
    return "locked" satisfies ClientStatus;
  }

  const allReady =
    input.snapshots.length > 0 && input.snapshots.every((snapshot) => isWorkspaceReady(snapshot));

  if (!allReady) {
    return "onboarding" satisfies ClientStatus;
  }

  // Strategy should unlock once AI review is ready; exception cleanup can continue in parallel.
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
  const evidence = await queryClientEvidence(clientId);

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

  const needsAttentionCount = evidence.documents.filter((document) => document.needsHumanReview)
    .length;
  const taggedCount = evidence.documents.filter((document) => document.disposition === "tagged")
    .length;
  const derivedStatus = deriveClientStatus({
    clientStatus: client.status,
    lockedStrategyVersion: client.lockedStrategyVersion,
    snapshots,
    needsAttentionCount,
  });

  const syncedClient =
    client.status !== derivedStatus ? updateClient(clientId, { status: derivedStatus }) ?? client : client;

  if (derivedStatus === "strategizing") {
    ensureClientTimelineEvent({
      id:
        needsAttentionCount > 0
          ? `${clientId}:strategy-unlocked`
          : `${clientId}:review-completed`,
      clientId,
      occurredAt: new Date().toISOString(),
      kind: needsAttentionCount > 0 ? "strategy-unlocked" : "review-completed",
      workspaceId: null,
      summary:
        needsAttentionCount > 0
          ? `AI preliminary review unlocked Strategy with ${needsAttentionCount} exception document(s) remaining.`
          : "All evidence grid review actions have been resolved.",
      metadata: {
        clientId,
        needsAttentionCount,
      },
    });
  }

  const clients = listClients();
  const denseWorkbenchHref = snapshots[0]?.activeJobId ? `/review/${snapshots[0].activeJobId}` : null;
  const strategyHref = `/clients/${clientId}/strategy`;
  const preliminaryGuidance = buildPreliminaryStrategyGuidance(evidence.documents);
  const timelineEvents = listClientTimeline(clientId);

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1600px]">
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
              { number: 2, label: "Review", state: "active" },
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
                    AI preliminary review
                  </p>
                  <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    Case map and evidence grid
                  </h1>
                  <p className="mt-2 max-w-4xl text-[12px] leading-6 text-[var(--muted)]">
                    Setu makes preliminary criterion, role, and packet-weight decisions first.
                    Review the exceptions, override anything questionable, and move into Strategy
                    to brainstorm the petition theory without confirming every low-risk tag.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:ml-auto">
                  <span className="rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                    {needsAttentionCount} exceptions
                  </span>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]">
                    {taggedCount} tagged or auto-set
                  </span>
                </div>
              </div>
              {derivedStatus === "onboarding" ? (
                <div className="mt-4 rounded-[14px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-3 text-[11px] leading-6 text-[var(--brand-deep)]">
                  Onboarding is still running for this client. The evidence grid is already
                  available for review, but more files may continue to appear until the workspace
                  reaches Ready.
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
                <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1">
                  AI proposes
                </span>
                <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1">
                  Attorney overrides
                </span>
                <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1">
                  Bundles remain convenience groups
                </span>
                <Link
                  href={strategyHref}
                  className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-1 text-[var(--foreground)]"
                >
                  Continue to strategy
                </Link>
              </div>
            </section>

            <PreliminaryStrategyPanel
              guidance={preliminaryGuidance}
              strategyHref={strategyHref}
            />

            <ReviewDecisionLedger
              clientId={clientId}
              documents={evidence.documents}
              guidance={preliminaryGuidance}
              timelineEvents={timelineEvents}
            />

            <EvidenceGrid
              clientId={clientId}
              clientName={syncedClient.displayName}
              initialDocuments={evidence.documents}
              bundleOptions={evidence.bundles}
              workspaceOptions={evidence.workspaces}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
