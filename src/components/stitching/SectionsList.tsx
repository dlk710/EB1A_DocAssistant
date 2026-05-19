"use client";

import { SectionTile } from "@/components/stitching/SectionTile";
import type { PetitionSection } from "@/lib/types";

export function SectionsList(props: { sections: PetitionSection[] }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Sections
        </p>
        <h2 className="mt-2 text-[18px] font-semibold text-[var(--foreground)]">
          Petition structure
        </h2>
      </div>
      <div className="space-y-3">
        {props.sections.map((section, index) => (
          <SectionTile key={`${section.kind}-${index}`} section={section} />
        ))}
      </div>
    </section>
  );
}
