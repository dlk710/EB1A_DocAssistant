"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { LockConfirmation } from "@/components/lock/LockConfirmation";
import { LockHero } from "@/components/lock/LockHero";
import { LockedCriterionRow } from "@/components/lock/LockedCriterionRow";
import { NarrativeSpineCard } from "@/components/lock/NarrativeSpineCard";
import { getCriterionDefinition, getCriterionDisplayName } from "@/lib/constants";
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
  const criterionCodes = useMemo(
    () =>
      strategyMemo
        ? [
            ...strategyMemo.recommendedMix.primary.map((entry) => entry.criterionCode),
            ...strategyMemo.recommendedMix.supporting.map((entry) => entry.criterionCode),
          ]
        : [],
    [strategyMemo],
  );
  const [numberingKind, setNumberingKind] = useState<"flat" | "letter-grouped" | "section-grouped">(
    "letter-grouped",
  );
  const defaultLetterMap = useMemo(
    () =>
      criterionCodes.reduce<Record<string, string>>((map, code, index) => {
        map[code] = String.fromCharCode(65 + index);
        return map;
      }, {}),
    [criterionCodes],
  );
  const [letterOverrides, setLetterOverrides] = useState<Record<string, string>>({});
  const letterMap = useMemo(
    () =>
      criterionCodes.reduce<Record<string, string>>((map, code) => {
        map[code] = letterOverrides[code] || defaultLetterMap[code] || "";
        return map;
      }, {}),
    [criterionCodes, defaultLetterMap, letterOverrides],
  );

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
          exhibitNumberingScheme: {
            kind: numberingKind,
            letterMap: numberingKind === "letter-grouped" ? letterMap : undefined,
          },
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
                <SetuHomeLink />
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
                          legalCode: getCriterionDefinition(entry.criterionCode)?.legalCode ?? entry.criterionCode,
                          criterionName: getCriterionDisplayName(entry.criterionCode),
                          role: "primary",
                          rationale: entry.rationale,
                          anchorDocIds: entry.anchorDocIds,
                          anchorExhibits: entry.anchorDocIds.map((documentId, index) => ({
                            documentId,
                            workspaceId: "pending",
                            exhibitNumber: `${index + 1}`,
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
                          legalCode: getCriterionDefinition(entry.criterionCode)?.legalCode ?? entry.criterionCode,
                          criterionName: getCriterionDisplayName(entry.criterionCode),
                          role: "supporting",
                          rationale: entry.rationale,
                          anchorDocIds: entry.anchorDocIds,
                          anchorExhibits: entry.anchorDocIds.map((documentId, index) => ({
                            documentId,
                            workspaceId: "pending",
                            exhibitNumber: `${index + 1}`,
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
                            {getCriterionDisplayName(entry.criterionCode)}
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

                <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Exhibit numbering
                  </p>
                  <div className="mt-3 space-y-3">
                    <select
                      value={numberingKind}
                      onChange={(event) =>
                        setNumberingKind(
                          event.target.value as "flat" | "letter-grouped" | "section-grouped",
                        )
                      }
                      className="w-full rounded-[12px] border border-[var(--border-secondary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)]"
                    >
                      <option value="letter-grouped">Letter grouped</option>
                      <option value="flat">Flat</option>
                      <option value="section-grouped">Section grouped</option>
                    </select>
                    {numberingKind === "letter-grouped" ? (
                      <div className="space-y-2">
                        {criterionCodes.map((code) => (
                          <label key={code} className="flex items-center justify-between gap-3 text-[11px] text-[var(--foreground)]">
                            <span>{getCriterionDisplayName(code)}</span>
                            <input
                              value={letterMap[code] ?? ""}
                              onChange={(event) =>
                                setLetterOverrides((current) => ({
                                  ...current,
                                  [code]: event.target.value.toUpperCase().slice(0, 3),
                                }))
                              }
                              className="w-16 rounded-[10px] border border-[var(--border-secondary)] bg-white px-2 py-1.5 text-center text-[11px]"
                            />
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
