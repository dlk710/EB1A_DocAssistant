"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LockConfirmation } from "@/components/lock/LockConfirmation";
import { LockHero } from "@/components/lock/LockHero";
import { LockedCriterionRow } from "@/components/lock/LockedCriterionRow";
import { NarrativeSpineCard } from "@/components/lock/NarrativeSpineCard";
import type { ChatArtifactRecord, StrategyMemo } from "@/lib/types";

export function LockWorkspace(props: {
  clientId: string;
  clientName: string;
  strategyMemo: StrategyMemo | null;
  pinnedArtifacts: ChatArtifactRecord[];
}) {
  const router = useRouter();
  const [narrativeSpine, setNarrativeSpine] = useState(
    props.strategyMemo?.leadArgument.narrativeSpine ?? "",
  );
  const [confirmed, setConfirmed] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pinnedMemo = useMemo(
    () => props.pinnedArtifacts.find((artifact) => artifact.kind === "strategy-memo") ?? null,
    [props.pinnedArtifacts],
  );
  const strategyMemo = props.strategyMemo ?? pinnedMemo?.strategyMemo ?? null;

  async function handleLock() {
    if (!strategyMemo) {
      setErrorMessage("Generate a strategy memo before locking.");
      return;
    }

    if (!confirmed) {
      setErrorMessage("Review and confirm the lock statement before continuing.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/clients/${props.clientId}/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmed: true,
          memoArtifactId: pinnedMemo?.id ?? null,
          narrativeSpine,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to lock the case theory.");
      }

      router.push(`/clients/${props.clientId}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to lock the case theory.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Lock</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}/strategy`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Back to Strategy
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 space-y-5">
          <LockHero
            onLock={() => void handleLock()}
            disabled={!strategyMemo || !confirmed}
            isSubmitting={isSubmitting}
          />

          {errorMessage ? (
            <div className="rounded-[18px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}

          {!strategyMemo ? (
            <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 text-[12px] leading-6 text-[var(--muted)]">
              Setu needs a strategy memo before it can lock the case theory.
            </section>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <main className="space-y-4">
                <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Criteria being locked
                  </p>
                  <div className="mt-4 space-y-3">
                    {strategyMemo.recommendedMix.primary.map((entry) => (
                      <LockedCriterionRow
                        key={`primary-${entry.criterionCode}`}
                        entry={{
                          criterionCode: entry.criterionCode,
                          legalCode: entry.criterionCode,
                          criterionName: entry.criterionCode,
                          role: "primary",
                          rationale: entry.rationale,
                          anchorDocIds: entry.anchorDocIds,
                          anchorExhibits: entry.anchorDocIds.map((documentId, index) => ({
                            documentId,
                            workspaceId: "pending",
                            exhibitNumber: index + 1,
                            exhibitLabel:
                              entry.anchorDocIds.length > 1
                                ? `Ex. ${index + 1}${String.fromCharCode(65 + index)}`
                                : `Ex. ${index + 1}`,
                            order: index,
                          })),
                        }}
                      />
                    ))}
                    {strategyMemo.recommendedMix.supporting.map((entry) => (
                      <LockedCriterionRow
                        key={`supporting-${entry.criterionCode}`}
                        entry={{
                          criterionCode: entry.criterionCode,
                          legalCode: entry.criterionCode,
                          criterionName: entry.criterionCode,
                          role: "supporting",
                          rationale: entry.rationale,
                          anchorDocIds: entry.anchorDocIds,
                          anchorExhibits: entry.anchorDocIds.map((documentId, index) => ({
                            documentId,
                            workspaceId: "pending",
                            exhibitNumber: index + 1,
                            exhibitLabel:
                              entry.anchorDocIds.length > 1
                                ? `Ex. ${index + 1}${String.fromCharCode(65 + index)}`
                                : `Ex. ${index + 1}`,
                            order: index,
                          })),
                        }}
                      />
                    ))}
                  </div>
                </section>

                {strategyMemo.recommendedMix.decline.length ? (
                  <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Criteria explicitly declined
                    </p>
                    <div className="mt-4 space-y-3">
                      {strategyMemo.recommendedMix.decline.map((entry) => (
                        <div
                          key={`decline-${entry.criterionCode}`}
                          className="rounded-[14px] bg-[var(--paper-secondary)] px-4 py-3"
                        >
                          <p className="text-[11px] font-semibold text-[var(--foreground)]">
                            {entry.criterionCode}
                          </p>
                          <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                            {entry.rationale}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <LockConfirmation checked={confirmed} onChange={setConfirmed} />
              </main>

              <aside className="space-y-4">
                <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Exhibit count
                  </p>
                  <p className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-[var(--brand)]">
                    {strategyMemo.recommendedMix.primary.reduce(
                      (sum, entry) => sum + entry.anchorDocIds.length,
                      0,
                    ) +
                      strategyMemo.recommendedMix.supporting.reduce(
                        (sum, entry) => sum + entry.anchorDocIds.length,
                        0,
                      )}
                  </p>
                </section>

                <NarrativeSpineCard value={narrativeSpine} onChange={setNarrativeSpine} />

                <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    After locking
                  </p>
                  <p className="mt-3 text-[12px] leading-6 text-[var(--muted)]">
                    Draft placeholders are created, criterion pinboards are seeded, exhibit numbers
                    become stable, and the client stage moves into the locked state.
                  </p>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
