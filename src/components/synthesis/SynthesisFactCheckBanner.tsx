"use client";

import type { SynthesisParagraph } from "@/lib/types";

export function SynthesisFactCheckBanner(props: { paragraphs: SynthesisParagraph[] }) {
  const flagged = props.paragraphs.filter(
    (paragraph) => paragraph.factCheckStatus && paragraph.factCheckStatus !== "verified",
  );
  if (!flagged.length) {
    return null;
  }

  return (
    <div className="rounded-[16px] border border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-warning)]">
      <p className="font-semibold">
        {flagged.length} paragraph{flagged.length === 1 ? "" : "s"} need synthesis fact-check attention.
      </p>
      <ul className="mt-2 space-y-1">
        {flagged.slice(0, 4).map((paragraph) => (
          <li key={paragraph.id}>{paragraph.factCheckNotes || "Review the paragraph against its cited support."}</li>
        ))}
      </ul>
    </div>
  );
}
