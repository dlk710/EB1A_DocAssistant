"use client";

import type { AuditFinding } from "@/lib/types";

export function FindingCard(props: { finding: AuditFinding }) {
  return (
    <div
      className={`rounded-[16px] border px-4 py-4 ${
        props.finding.severity === "blocking"
          ? "border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)]"
          : props.finding.severity === "warning"
            ? "border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)]"
            : "border-[var(--border-secondary)] bg-[var(--paper-secondary)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-[var(--foreground)]">{props.finding.description}</p>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {props.finding.severity}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.finding.suggestedActions.map((action) => (
          <span
            key={`${props.finding.id}-${action.action}`}
            className="rounded-full border border-[var(--border-primary)] bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
          >
            {action.label}
          </span>
        ))}
      </div>
    </div>
  );
}
