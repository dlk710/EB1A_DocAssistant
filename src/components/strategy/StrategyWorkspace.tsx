"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatDock } from "@/components/chat/ChatDock";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { CriteriaGrid } from "@/components/strategy/CriteriaGrid";
import { CoverageCard } from "@/components/strategy/CoverageCard";
import { StrategyMemoCard } from "@/components/strategy/StrategyMemoCard";
import { StressTestReportCard } from "@/components/strategy/StressTestReportCard";
import type { ChatMessageCitation, StressTestReport, StrategyMemo, WorkspaceCoverage } from "@/lib/types";

interface StrategyMemoPayload {
  memo: StrategyMemo;
  citations: ChatMessageCitation[];
  droppedClaims: string[];
  reasoning: string;
  pendingDisclosure: string | null;
  costUsd: number;
}

interface StressTestPayload {
  report: StressTestReport;
  citations: ChatMessageCitation[];
  droppedClaims: string[];
  reasoning: string;
  pendingDisclosure: string | null;
  costUsd: number;
}

export function StrategyWorkspace(props: {
  clientId: string;
  clientName: string;
  workspaceCount: number;
  coverage: WorkspaceCoverage | null;
  initialMemo: StrategyMemo | null;
  initialReport: StressTestReport | null;
}) {
  const router = useRouter();
  const [memoState, setMemoState] = useState<StrategyMemoPayload | null>(
    props.initialMemo
      ? {
          memo: props.initialMemo,
          citations: [],
          droppedClaims: [],
          reasoning: "This memo was loaded from the latest saved strategy state for the client.",
          pendingDisclosure: null,
          costUsd: 0,
        }
      : null,
  );
  const [reportState, setReportState] = useState<StressTestPayload | null>(
    props.initialReport
      ? {
          report: props.initialReport,
          citations: [],
          droppedClaims: [],
          reasoning: "This report was loaded from the latest saved stress-test state for the client.",
          pendingDisclosure: null,
          costUsd: 0,
        }
      : null,
  );
  const [isGeneratingMemo, setIsGeneratingMemo] = useState(() => props.initialMemo === null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isPinningMemo, setIsPinningMemo] = useState(false);
  const [isPinningReport, setIsPinningReport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (memoState) {
      return;
    }

    let cancelled = false;

    fetch(`/api/clients/${props.clientId}/strategy-memo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ regenerate: true }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as StrategyMemoPayload | { error?: string };

        if (!response.ok || !("memo" in payload)) {
          throw new Error(("error" in payload && payload.error) || "Unable to generate strategy memo.");
        }

        if (!cancelled) {
          setMemoState(payload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to generate strategy memo.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeneratingMemo(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [memoState, props.clientId]);

  async function regenerateMemo() {
    setIsGeneratingMemo(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/clients/${props.clientId}/strategy-memo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ regenerate: true }),
      });
      const payload = (await response.json()) as StrategyMemoPayload | { error?: string };

      if (!response.ok || !("memo" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Unable to regenerate strategy memo.");
      }

      setMemoState(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to regenerate strategy memo.");
    } finally {
      setIsGeneratingMemo(false);
    }
  }

  async function runStressTest() {
    setIsGeneratingReport(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/clients/${props.clientId}/stress-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as StressTestPayload | { error?: string };

      if (!response.ok || !("report" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Unable to run the stress-test.");
      }

      setReportState(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to run the stress-test.");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function pinLatest(kind: "strategy-memo" | "stress-test-report") {
    setErrorMessage(null);
    if (kind === "strategy-memo") {
      setIsPinningMemo(true);
    } else {
      setIsPinningReport(true);
    }

    try {
      const response = await fetch("/api/chat/artifacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: props.clientId,
          kind,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to pin the latest artifact.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to pin the latest artifact.");
    } finally {
      setIsPinningMemo(false);
      setIsPinningReport(false);
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
                  <span>{props.clientName} · Strategy</span>
                </span>
              </div>
              <div className="space-y-1">
                <p className="setu-brand-tagline">Setu reads the full client record and proposes a case theory.</p>
                <p className="setu-brand-meta">
                  Review the coverage, inspect the memo, stress-test the theory, and lock only when you&apos;re ready to commit.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}/review`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Back to review
              </Link>
              <Link
                href={`/clients/${props.clientId}/lock`}
                className="setu-primary-button inline-flex items-center rounded-[8px] px-4 py-2 text-[11px] font-semibold text-white"
              >
                Commit to Lock
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <CoverageCard coverage={props.coverage} />
            <CriteriaGrid coverage={props.coverage} />

            {errorMessage ? (
              <div className="rounded-[18px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
                {errorMessage}
              </div>
            ) : null}

            <StrategyMemoCard
              memo={memoState?.memo ?? null}
              citations={memoState?.citations ?? []}
              reasoning={memoState?.reasoning ?? "Strategy reasoning will appear after generation."}
              pendingDisclosure={memoState?.pendingDisclosure}
              droppedClaims={memoState?.droppedClaims}
              onPin={() => void pinLatest("strategy-memo")}
              onRegenerate={() => void regenerateMemo()}
              onStressTest={() => void runStressTest()}
              onCommitToLock={() => router.push(`/clients/${props.clientId}/lock`)}
              isBusy={isGeneratingMemo || isPinningMemo}
            />

            <StressTestReportCard
              report={reportState?.report ?? null}
              citations={reportState?.citations ?? []}
              reasoning={
                reportState?.reasoning ?? "Stress-test reasoning will appear after running the report."
              }
              pendingDisclosure={reportState?.pendingDisclosure}
              droppedClaims={reportState?.droppedClaims}
              onPin={() => void pinLatest("stress-test-report")}
              isBusy={isGeneratingReport || isPinningReport}
            />
          </main>

          <aside>
            <ChatDock
              clientId={props.clientId}
              candidateName={props.clientName}
              workspaceCount={props.workspaceCount}
              variant="panel"
              initialMode="strategy"
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
