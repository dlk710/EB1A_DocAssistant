"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  MessageSquareMore,
  MessageSquareText,
  Pin,
  SendHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { ArtifactShelf } from "@/components/chat/ArtifactShelf";
import { BriefDraftCard } from "@/components/chat/BriefDraftCard";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ModeSelector } from "@/components/chat/ModeSelector";
import { StressTestReportCard } from "@/components/chat/StressTestReportCard";
import { StrategyMemoCard } from "@/components/chat/StrategyMemoCard";
import type {
  ChatArtifactRecord,
  ChatMode,
  ChatSession,
  ChatTurn,
} from "@/lib/types";

interface ChatReadyResponse {
  ready: boolean;
  reason: string | null;
}

interface ChatArtifactsResponse {
  artifacts: ChatArtifactRecord[];
}

interface ChatSessionResponse {
  session: ChatSession;
}

interface ChatTurnResponse {
  session: ChatSession;
  userTurn: ChatTurn;
  assistantTurn: ChatTurn;
}

export function ChatDock(props: {
  jobId: string | null;
  candidateName: string;
}) {
  const [mode, setMode] = useState<ChatMode>("triage");
  const [isOpen, setIsOpen] = useState(false);
  const [readyState, setReadyState] = useState<ChatReadyResponse>({
    ready: false,
    reason: "Select a folder workspace first.",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPinningTurnId, setIsPinningTurnId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [artifacts, setArtifacts] = useState<ChatArtifactRecord[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);

  const orderedTurns = useMemo(() => session?.turns ?? [], [session]);
  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  );
  const starterSuggestions = [
    {
      label: "Build petition strategy",
      mode: "strategy" as const,
      prompt:
        "Recommend the strongest EB1A strategy for this workspace and explain the lead criterion.",
    },
    {
      label: "Challenge the case",
      mode: "stress-test" as const,
      prompt:
        "Stress-test this case like a skeptical USCIS adjudicator and show the biggest risks.",
    },
    {
      label: "Draft a section",
      mode: "draft" as const,
      prompt:
        "Draft a criterion argument using the best kept evidence in this workspace.",
    },
  ];

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!props.jobId) {
        setReadyState({
          ready: false,
          reason: "Select a folder workspace first.",
        });
        setSession(null);
        setArtifacts([]);
        setSelectedArtifactId(null);
        return;
      }

      setIsLoading(true);

      try {
        const [readyResponse, artifactsResponse] = await Promise.all([
          fetch(`/api/chat/ready?jobId=${encodeURIComponent(props.jobId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/chat/artifacts?jobId=${encodeURIComponent(props.jobId)}`, {
            cache: "no-store",
          }),
        ]);

        const readyPayload = (await readyResponse.json()) as ChatReadyResponse;
        const artifactsPayload = (await artifactsResponse.json()) as ChatArtifactsResponse;

        if (cancelled) {
          return;
        }

        const nextArtifacts = artifactsPayload.artifacts || [];

        setReadyState(readyPayload);
        setArtifacts(nextArtifacts);
        setSelectedArtifactId((current) =>
          nextArtifacts.some((artifact) => artifact.id === current)
            ? current
            : nextArtifacts[0]?.id ?? null,
        );
        setErrorMessage(null);

        if (readyPayload.ready) {
          const sessionResponse = await fetch("/api/chat/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jobId: props.jobId,
            }),
          });

          const sessionPayload = (await sessionResponse.json()) as ChatSessionResponse | { error?: string };

          if (!cancelled && "session" in sessionPayload) {
            setSession(sessionPayload.session);
          }
        } else {
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [props.jobId]);

  const handleSend = async () => {
    if (!props.jobId || !draftMessage.trim() || !readyState.ready) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/chat/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: props.jobId,
          sessionId: session?.id,
          message: draftMessage.trim(),
          modeHint: mode,
        }),
      });

      const payload = (await response.json()) as ChatTurnResponse | { error?: string };

      if (!response.ok || !("session" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Unable to send chat turn.");
      }

      setSession(payload.session);
      setDraftMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send chat turn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePin = async (turn: ChatTurn) => {
    if (!props.jobId || !session || !turn.assistantPayload) {
      return;
    }

    const kind =
      turn.assistantPayload.kind === "strategy"
        ? "strategy-memo"
        : turn.assistantPayload.kind === "stress-test"
          ? "stress-test"
          : turn.assistantPayload.kind === "draft"
            ? "brief-draft"
            : null;

    if (!kind) {
      return;
    }

    setIsPinningTurnId(turn.id);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/chat/artifacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: props.jobId,
          sessionId: session.id,
          turnId: turn.id,
          kind,
        }),
      });

      const payload = (await response.json()) as
        | { artifacts: ChatArtifactRecord[] }
        | { error?: string };

      if (!response.ok || !("artifacts" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Unable to pin artifact.");
      }

      setArtifacts(payload.artifacts);
      setSelectedArtifactId(payload.artifacts[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to pin artifact.");
    } finally {
      setIsPinningTurnId(null);
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    if (!props.jobId) {
      return;
    }

    setDeletingArtifactId(artifactId);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/chat/artifacts/${artifactId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: props.jobId,
        }),
      });

      const payload = (await response.json()) as
        | { artifacts: ChatArtifactRecord[] }
        | { error?: string };

      if (!response.ok || !("artifacts" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Unable to unpin artifact.");
      }

      setArtifacts(payload.artifacts);
      setSelectedArtifactId((current) => {
        if (current !== artifactId) {
          return current;
        }

        return payload.artifacts[0]?.id ?? null;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to unpin artifact.");
    } finally {
      setDeletingArtifactId(null);
    }
  };

  return (
    <>
      <div className="setu-paper-panel rounded-[18px] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Ask the studio
              </p>
              <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
                Strategy partner for {props.candidateName || "this workspace"}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                {isLoading
                  ? "Checking workspace readiness…"
                  : readyState.ready
                    ? "Open a larger chat workspace for strategy, stress-test, drafting, and evidence triage."
                    : readyState.reason || "The studio opens once tagging completes."}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
              readyState.ready
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-[var(--border-primary)] bg-white text-[var(--muted)]"
            }`}
          >
            {readyState.ready ? "ready" : "preparing"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Session
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
              {session ? session.id.slice(0, 8) : "Not ready"}
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Turns
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
              {orderedTurns.length}
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Artifacts
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
              {artifacts.length}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--brand-charcoal)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-95"
        >
          <MessageSquareText className="h-4 w-4" />
          Open Ask Setu
        </button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.46)] p-4 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="mx-auto flex h-full max-h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[24px] border border-white/70 bg-[var(--background)] shadow-[0_24px_80px_rgba(15,23,42,0.26)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-secondary)] bg-white/86 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    Ask the studio
                  </p>
                  <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
                    Strategy workspace for {props.candidateName || "this candidate"}
                  </h2>
                  <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                    Ask evidence questions, build strategy, stress-test the case, or draft
                    petition sections with workspace-scoped citations.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--foreground)] transition hover:bg-[var(--paper-secondary)]"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-auto border-b border-[var(--border-secondary)] bg-[var(--paper-primary)] p-4 lg:border-b-0 lg:border-r">
                <div>
                  <ModeSelector value={mode} onChange={setMode} disabled={!readyState.ready} />
                </div>

                <div className="mt-4">
                  <ArtifactShelf
                    artifacts={artifacts}
                    selectedArtifactId={selectedArtifactId}
                    deletingArtifactId={deletingArtifactId}
                    onSelect={setSelectedArtifactId}
                    onDelete={(artifactId) => void handleDeleteArtifact(artifactId)}
                  />
                </div>

                {selectedArtifact ? (
                  <div className="mt-4">
                    {selectedArtifact.strategyMemo ? (
                      <StrategyMemoCard
                        memo={selectedArtifact.strategyMemo}
                        pendingDisclosure={null}
                        citations={[]}
                      />
                    ) : selectedArtifact.stressTestReport ? (
                      <StressTestReportCard
                        report={selectedArtifact.stressTestReport}
                        pendingDisclosure={null}
                        citations={[]}
                      />
                    ) : selectedArtifact.briefDraft ? (
                      <BriefDraftCard draft={selectedArtifact.briefDraft} citations={[]} />
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 rounded-[14px] border border-[var(--border-secondary)] bg-white p-3">
                  <div className="flex items-start gap-2">
                    <Pin className="mt-0.5 h-3.5 w-3.5 text-[var(--brand-deep)]" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Cost guide
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
                        Triage ~$0.02 • Strategy ~$0.08 • Stress-test ~$0.06 • Draft ~$0.10 per
                        turn
                      </p>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex min-h-0 flex-col bg-[var(--background)]">
                <div className="border-b border-[var(--border-secondary)] px-5 py-4">
                  <MessageBubble role="assistant">
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Checking workspace readiness for strategy chat…
                      </span>
                    ) : readyState.ready ? (
                      <>
                        <span className="block font-semibold">
                          The workspace is ready for Ask the Studio.
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-[var(--muted)]">
                          Ask document questions in Triage, pin a Strategy memo, then use
                          Stress-test or Draft against that agreed case theory.
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block font-semibold">
                          Setu finishes preparing the evidence first.
                        </span>
                        <span className="mt-1 block text-[11px] leading-5 text-[var(--muted)]">
                          {readyState.reason || "The studio opens once tagging completes."}
                        </span>
                      </>
                    )}
                  </MessageBubble>

                  {session ? (
                    <div className="mt-3 rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2.5">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                        <MessageSquareMore className="h-3.5 w-3.5" />
                        Session ready
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-[var(--foreground)]">
                        Session <span className="font-mono">{session.id.slice(0, 8)}</span> is
                        ready for chat turns on this workspace.
                      </p>
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <div className="mt-3 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-800">
                      {errorMessage}
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
                  {orderedTurns.length ? (
                    <div className="space-y-3 pr-1">
                      {orderedTurns.map((turn) => (
                        <div key={turn.id} className="space-y-2">
                          <MessageBubble role={turn.role === "user" ? "user" : "assistant"}>
                            <div className="space-y-2">
                              {turn.role === "assistant" ? (
                                <>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-[var(--paper-secondary)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                                      {turn.mode || "assistant"}
                                    </span>
                                    {turn.classification &&
                                    turn.classification.alternateMode &&
                                    turn.classification.confidence < 0.65 ? (
                                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                        Consider {turn.classification.alternateMode}
                                      </span>
                                    ) : null}
                                    {turn.usageCostUsd ? (
                                      <span className="text-[10px] text-[var(--muted)]">
                                        {`$${turn.usageCostUsd.toFixed(4)}`}
                                      </span>
                                    ) : null}
                                  </div>

                                  <p className="whitespace-pre-wrap text-[12px] leading-6">
                                    {turn.message}
                                  </p>

                                  {turn.assistantPayload?.kind === "strategy" &&
                                  turn.assistantPayload.strategyMemo ? (
                                    <StrategyMemoCard
                                      memo={turn.assistantPayload.strategyMemo}
                                      pendingDisclosure={turn.assistantPayload.pendingDocsDisclosure}
                                      citations={turn.assistantPayload.citations}
                                      onPin={() => void handlePin(turn)}
                                      isPinning={isPinningTurnId === turn.id}
                                    />
                                  ) : turn.assistantPayload?.kind === "stress-test" &&
                                    turn.assistantPayload.stressTestReport ? (
                                    <StressTestReportCard
                                      report={turn.assistantPayload.stressTestReport}
                                      pendingDisclosure={turn.assistantPayload.pendingDocsDisclosure}
                                      citations={turn.assistantPayload.citations}
                                      onPin={() => void handlePin(turn)}
                                      isPinning={isPinningTurnId === turn.id}
                                    />
                                  ) : turn.assistantPayload?.kind === "draft" &&
                                    turn.assistantPayload.briefDraft ? (
                                    <BriefDraftCard
                                      draft={turn.assistantPayload.briefDraft}
                                      citations={turn.assistantPayload.citations}
                                      onPin={() => void handlePin(turn)}
                                      isPinning={isPinningTurnId === turn.id}
                                    />
                                  ) : turn.assistantPayload?.citations?.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {turn.assistantPayload.citations.map((citation) => (
                                        <span
                                          key={`${turn.id}-${citation.docId}`}
                                          className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
                                        >
                                          {citation.label}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <p className="whitespace-pre-wrap text-[12px] leading-6">
                                  {turn.message}
                                </p>
                              )}
                            </div>
                          </MessageBubble>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[16px] border border-dashed border-[var(--border-primary)] bg-white/70 px-4 py-6 text-[12px] leading-6 text-[var(--muted)]">
                      Start with a question about evidence, case strategy, weaknesses, or a draft
                      section. Setu will stay inside the current workspace and cite source
                      documents.
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border-secondary)] bg-white/86 px-5 py-4">
                  {!orderedTurns.length && readyState.ready ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {starterSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.label}
                          type="button"
                          onClick={() => {
                            setMode(suggestion.mode);
                            setDraftMessage(suggestion.prompt);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold text-[var(--foreground)] transition hover:bg-[var(--paper-secondary)]"
                        >
                          <WandSparkles className="h-3.5 w-3.5 text-[var(--brand-deep)]" />
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Ask Setu
                    </span>
                    <textarea
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder={
                        readyState.ready
                          ? "Ask about a document, a strategy, a risk, or a draft section."
                          : "The studio opens after tagging completes."
                      }
                      disabled={!readyState.ready || isSubmitting}
                      rows={5}
                      title={!readyState.ready ? readyState.reason || undefined : undefined}
                      className="w-full rounded-[14px] border border-[var(--border-secondary)] bg-white px-4 py-3 text-[13px] leading-6 outline-none disabled:cursor-not-allowed disabled:bg-[var(--paper-secondary)]"
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] leading-5 text-[var(--muted)]">
                      The studio uses only the active workspace and cites source documents.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={!readyState.ready || !draftMessage.trim() || isSubmitting}
                      className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--brand-charcoal)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSubmitting ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <SendHorizontal className="h-3.5 w-3.5" />
                      )}
                      {isSubmitting ? "Sending" : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
