"use client";

import type { SubsectionDraft } from "@/lib/types";

function statusTone(status: SubsectionDraft["status"], active: boolean) {
  if (active) {
    return "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white";
  }
  if (status === "approved") {
    return "border-[var(--state-success)]/20 bg-[var(--state-success-soft)] text-[var(--state-success)]";
  }
  if (status === "out-of-date") {
    return "border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] text-[var(--state-warning)]";
  }
  return "border-[var(--border-secondary)] bg-[var(--paper-primary)] text-[var(--foreground)]";
}

function renderTree(
  node: SubsectionDraft,
  activeSubsectionId: string,
  onSelectSubsection: (subsectionId: string) => void,
) {
  const active = node.id === activeSubsectionId;

  return (
    <div key={node.id} className="space-y-2">
      <button
        type="button"
        onClick={() => onSelectSubsection(node.id)}
        className={`flex w-full items-start justify-between gap-3 rounded-[14px] border px-3 py-2 text-left transition ${statusTone(node.status, active)}`}
        style={{ marginLeft: node.level * 12 }}
      >
        <div>
          <p className="text-[11px] font-semibold">{node.title}</p>
          <p className={`mt-1 text-[10px] ${active ? "text-white/72" : "text-current/72"}`}>
            {node.level === 0 ? "Criterion introduction" : node.level === 1 ? "Section" : "Sub-claim"}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${active ? "bg-white/12 text-white" : "bg-white/70 text-current"}`}>
          {node.status.replaceAll("-", " ")}
        </span>
      </button>
      {node.children.length ? (
        <div className="space-y-2">
          {node.children.map((child) => renderTree(child, activeSubsectionId, onSelectSubsection))}
        </div>
      ) : null}
    </div>
  );
}

export function SubsectionTree(props: {
  root: SubsectionDraft;
  activeSubsectionId: string;
  onSelectSubsection: (subsectionId: string) => void;
}) {
  return (
    <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Argument tree
      </p>
      <div className="mt-4 space-y-2">
        {renderTree(props.root, props.activeSubsectionId, props.onSelectSubsection)}
      </div>
    </section>
  );
}
