"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, MessageSquareText, Sparkles, X } from "lucide-react";
import { ArtifactShelf } from "@/components/chat/ArtifactShelf";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ModeSelector } from "@/components/chat/ModeSelector";
import type {
  ChatArtifactRecord,
  ChatMode,
  ChatSession,
  ChatTurn,
  SynthesisSectionKind,
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
  turn: ChatTurn;
  modeProposal:
    | {
        suggestedMode: ChatMode;
        alternateMode: ChatMode | null;
        reasoning: string;
      }
    | null;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  if (!raw.trim()) {
    throw new Error("Setu returned an empty response.");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Setu returned an unreadable response.");
  }
}

export function ChatDock(props: {
  clientId: string | null;
  candidateName: string;
  workspaceCount: number;
  variant?: "launcher" | "panel";
  initialMode?: ChatMode;
  criterionCode?: string | null;
  synthesisKind?: SynthesisSectionKind | null;
  draftEnabled?: boolean;
}) {
  const variant = props.variant ?? "launcher";
  const [mode, setMode] = useState<ChatMode>(props.initialMode ?? "strategy");
  const [isOpen, setIsOpen] = useState(false);
  const [readyState, setReadyState] = useState<ChatReadyResponse>({
    ready: false,
    reason: "Select a client first.",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modeProposal, setModeProposal] = useState<ChatTurnResponse["modeProposal"]>(null);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [artifacts, setArtifacts] = useState<ChatArtifactRecord[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);

  const orderedTurns = useMemo(() => session?.turns ?? [], [session]);
  const dockIsOpen = variant === "panel" ? true : isOpen;

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!props.clientId) {
        setReadyState({
          ready: false,
          reason: "Select a client first.",
        });
        setSession(null);
        setArtifacts([]);
        return;
      }

      setIsLoading(true);

      try {
        const [readyResponse, artifactsResponse, sessionResponse] = await Promise.all([
          fetch(`/api/chat/ready?clientId=${encodeURIComponent(props.clientId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/chat/artifacts?clientId=${encodeURIComponent(props.clientId)}`, {
            cache: "no-store",
          }),
          fetch("/api/chat/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clientId: props.clientId,
            }),
          }),
        ]);

        const readyPayload = await readJsonResponse<ChatReadyResponse>(readyResponse);
        const artifactsPayload = await readJsonResponse<ChatArtifactsResponse>(artifactsResponse);
        const sessionPayload = await readJsonResponse<
          ChatSessionResponse | { error?: string }
        >(sessionResponse);

        if (cancelled) {
          return;
        }

        setReadyState(readyPayload);
        setArtifacts(artifactsPayload.artifacts || []);
        setSelectedArtifactId((current) =>
          artifactsPayload.artifacts.some((artifact) => artifact.id === current)
            ? current
            : artifactsPayload.artifacts[0]?.id ?? null,
        );

        if ("session" in sessionPayload && readyPayload.ready) {
          setSession(sessionPayload.session);
        } else if (!readyPayload.ready) {
          setSession(null);
        }

        setErrorMessage(null);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to load Ask Setu right now.",
          );
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
  }, [props.clientId]);

  async function handleSend() {
    if (!props.clientId || !draftMessage.trim()) {
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
          clientId: props.clientId,
          sessionId: session?.id,
          message: draftMessage.trim(),
          modeHint: mode,
          criterionCode: props.criterionCode,
          synthesisKind: props.synthesisKind,
        }),
      });

      const payload = await readJsonResponse<ChatTurnResponse | { error?: string }>(response);

      if (!response.ok || !("session" in payload)) {
        throw new Error(("error" in payload && payload.error) || "Unable to send chat turn.");
      }

      setSession(payload.session);
      setModeProposal(payload.modeProposal);
      setDraftMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send chat turn.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteArtifact(artifactId: string) {
    if (!props.clientId) {
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
          clientId: props.clientId,
        }),
      });

      const payload = await readJsonResponse<
        | { artifacts: ChatArtifactRecord[] }
        | { error?: string }
      >(response);

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
  }

  const body = (
    <div className="flex min-h-0 flex-col rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[var(--border-secondary)] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Ask setu
            </p>
            <h2 className="mt-1 text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
              {variant === "panel"
                ? `Ask setu · ${props.workspaceCount} workspaces`
                : `Strategy workspace for ${props.candidateName || "this client"}`}
            </h2>
            <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
              {readyState.ready
                ? "Ask evidence questions, build strategy, or stress-test the case with client-scoped citations."
                : readyState.reason || "Setu finishes preparing the evidence first."}
            </p>
          </div>
          {variant === "launcher" ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[1fr]">
        <div className="min-h-0 overflow-auto px-4 py-4">
          <div className="mb-4 space-y-4">
            <ModeSelector
              value={mode}
              onChange={setMode}
              disabled={!readyState.ready}
              draftDisabled={!props.draftEnabled}
              draftTooltip="Available in the criterion drafting workspace"
            />
            <ArtifactShelf
              artifacts={artifacts}
              selectedArtifactId={selectedArtifactId}
              deletingArtifactId={deletingArtifactId}
              onSelect={setSelectedArtifactId}
              onDelete={(artifactId) => void handleDeleteArtifact(artifactId)}
            />
          </div>

          {isLoading ? (
            <div className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-5 text-[12px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Checking readiness…
              </span>
            </div>
          ) : null}

          {modeProposal ? (
            <div className="mb-4 rounded-[16px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-warning)]">
              <p className="font-semibold">
                Setu thinks this may fit {modeProposal.suggestedMode} better.
              </p>
              <p className="mt-1">{modeProposal.reasoning}</p>
              <button
                type="button"
                onClick={() => {
                  setMode(modeProposal.suggestedMode);
                  setModeProposal(null);
                }}
                className="mt-3 inline-flex items-center rounded-[8px] border border-[var(--state-warning)]/20 bg-white px-3 py-2 text-[11px] font-medium text-[var(--state-warning)]"
              >
                Switch to {modeProposal.suggestedMode}
              </button>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mb-4 rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}

          <div className="space-y-4">
            {orderedTurns.length ? (
              orderedTurns.map((turn) => <ChatMessage key={turn.id} turn={turn} />)
            ) : (
              <div className="rounded-[16px] border border-dashed border-[var(--border-primary)] bg-[var(--paper-secondary)] px-4 py-6 text-[12px] leading-6 text-[var(--muted)]">
                {props.draftEnabled
                  ? "Start with a draft request, a citation check, or a criterion-specific follow-up."
                  : "Start with a follow-up on evidence, a strategy question, or a stress-test request."}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--border-secondary)] px-4 py-4">
          <ChatInput
            value={draftMessage}
            onChange={setDraftMessage}
            onSubmit={() => void handleSend()}
            disabled={!readyState.ready}
            isSubmitting={isSubmitting}
            placeholder={props.draftEnabled ? "Ask Setu to draft or refine this criterion…" : "Ask a follow-up…"}
          />
        </div>
      </div>
    </div>
  );

  if (variant === "panel") {
    return body;
  }

  return (
    <>
      <div className="setu-paper-panel rounded-[18px] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-deep)]">
            <MessageSquareText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Ask setu
            </p>
            <p className="mt-1 text-[12px] font-semibold text-[var(--foreground)]">
              Strategy partner for {props.candidateName || "this client"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
              {readyState.ready
                ? "Open a larger strategy chat workspace."
                : readyState.reason || "The studio opens once every workspace is ready."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={!readyState.ready}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--brand-charcoal)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Open Ask Setu
        </button>
      </div>

      {dockIsOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.46)] p-4 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="mx-auto flex h-full max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[24px]"
            onClick={(event) => event.stopPropagation()}
          >
            {body}
          </div>
        </div>
      ) : null}
    </>
  );
}
