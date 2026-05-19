import { BriefDraftCard } from "@/components/chat/BriefDraftCard";
import { CitationChip } from "@/components/chat/CitationChip";
import { ReasoningExpansion } from "@/components/chat/ReasoningExpansion";
import type { ChatTurn } from "@/lib/types";

export function ChatMessage(props: { turn: ChatTurn }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[92%] rounded-[16px] border border-[var(--brand)]/18 bg-[var(--brand-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--brand-deep)]">
          {props.turn.userMessage}
        </div>
      </div>
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {props.turn.mode}
          </span>
          {props.turn.modeWasProposed && props.turn.classification ? (
            <span className="rounded-full bg-[var(--state-warning-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--state-warning)]">
              classifier suggested {props.turn.classification.mode}
            </span>
          ) : null}
          {props.turn.costUsd ? (
            <span className="text-[10px] text-[var(--muted)]">{`$${props.turn.costUsd.toFixed(4)}`}</span>
          ) : null}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[12px] leading-6 text-[var(--foreground)]">
          {props.turn.response.text}
        </p>
        {props.turn.response.artifact?.schemaVersion === "brief-draft/2.0" ? (
          <div className="mt-3">
            <BriefDraftCard
              draft={props.turn.response.artifact}
              citations={props.turn.response.citations}
            />
          </div>
        ) : null}
        {props.turn.response.pendingDisclosure ? (
          <p className="mt-3 rounded-[12px] bg-[var(--paper-secondary)] px-3 py-2 text-[11px] leading-5 text-[var(--muted)]">
            {props.turn.response.pendingDisclosure}
          </p>
        ) : null}
        {props.turn.response.citations.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {props.turn.response.citations.map((citation) => (
              <CitationChip key={`${props.turn.id}-${citation.docId}-${citation.supports}`} citation={citation} />
            ))}
          </div>
        ) : null}
        <div className="mt-3">
          <ReasoningExpansion
            reasoning={props.turn.response.reasoning}
            droppedClaims={props.turn.response.droppedClaims}
          />
        </div>
      </div>
    </div>
  );
}
