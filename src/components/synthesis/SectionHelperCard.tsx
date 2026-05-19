"use client";

import type { SynthesisSectionKind } from "@/lib/types";

const COPY: Record<SynthesisSectionKind, { title: string; body: string }> = {
  "statement-of-eligibility": {
    title: "Why this section is hard",
    body:
      "The opening must be concise and controlled. It should frame the claimed criteria and the lead theory without re-arguing the petition or overstating the approved drafts.",
  },
  "final-merits-determination": {
    title: "Why this section is hard",
    body:
      "This closing section has to synthesize across criteria rather than repeat them. It should follow the threshold-plus-totality structure and stay disciplined about what the approved record actually proves.",
  },
};

export function SectionHelperCard(props: { kind: SynthesisSectionKind }) {
  const helper = COPY[props.kind];
  return (
    <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {helper.title}
      </p>
      <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">{helper.body}</p>
    </div>
  );
}
