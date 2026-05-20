"use client";

import { getCriterionDisplayName } from "@/lib/constants";
import type { PetitionSection } from "@/lib/types";

function sectionLabel(section: PetitionSection) {
  switch (section.kind) {
    case "cover":
      return "Cover sheet";
    case "table-of-contents":
      return "Table of contents";
    case "statement-of-eligibility":
      return "Statement of Eligibility";
    case "criterion-argument":
      return getCriterionDisplayName(section.criterionCode, "Criterion");
    case "final-merits-determination":
      return "Final Merits Determination";
    case "exhibit-index":
      return "Exhibit Index";
    case "exhibit":
      return `${section.exhibitNumber} · ${section.title}`;
    default:
      return "Section";
  }
}

function sourceLabel(section: PetitionSection) {
  switch (section.kind) {
    case "statement-of-eligibility":
      return `from Synthesis · approved v${section.sourceSynthesisVersion}`;
    case "criterion-argument":
      return `from Drafting · approved v${section.sourceDraftVersion}`;
    case "final-merits-determination":
      return `from Synthesis · approved v${section.sourceSynthesisVersion}`;
    case "exhibit":
      return section.sourceMimeType;
    default:
      return "system section";
  }
}

export function SectionTile(props: { section: PetitionSection }) {
  return (
    <div className="rounded-[16px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">{sectionLabel(props.section)}</p>
          <p className="mt-1 text-[11px] leading-6 text-[var(--muted)]">{sourceLabel(props.section)}</p>
        </div>
        <span className="rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {props.section.pageCount} page{props.section.pageCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {props.section.bates.start} → {props.section.bates.end}
      </p>
    </div>
  );
}
