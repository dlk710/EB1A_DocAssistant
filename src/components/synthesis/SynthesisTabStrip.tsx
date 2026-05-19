"use client";

import type { SynthesisSectionKind } from "@/lib/types";

interface TabEntry {
  kind: SynthesisSectionKind;
  label: string;
  status: "approved" | "in-progress" | "not-started" | "out-of-date";
  versionLabel: string;
}

export function SynthesisTabStrip(props: {
  activeKind: SynthesisSectionKind;
  tabs: TabEntry[];
  onChange: (kind: SynthesisSectionKind) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.tabs.map((tab) => (
        <button
          key={tab.kind}
          type="button"
          onClick={() => props.onChange(tab.kind)}
          className={`rounded-[14px] border px-3 py-2 text-left transition ${
            props.activeKind === tab.kind
              ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white"
              : tab.status === "approved"
                ? "border-[var(--state-success)]/20 bg-[var(--state-success-soft)] text-[var(--state-success)]"
                : tab.status === "out-of-date"
                  ? "border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
                  : "border-[var(--border-secondary)] bg-[var(--paper-primary)] text-[var(--foreground)]"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{tab.label}</p>
          <p className={`mt-1 text-[10px] ${props.activeKind === tab.kind ? "text-white/72" : "text-current/72"}`}>
            {tab.versionLabel}
          </p>
        </button>
      ))}
    </div>
  );
}
