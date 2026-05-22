"use client";

import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

export function GridHeader() {
  return (
    <thead className="sticky top-0 z-20 bg-[var(--paper-primary)] shadow-[0_1px_0_var(--border-secondary)]">
      <tr className="text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        <th className="px-2 py-2.5">Sel</th>
        <th className="px-2 py-2.5">Document</th>
        {EB1A_CRITERIA_DEFINITIONS.map((criterion) => (
          <th key={criterion.code} className="px-1 py-2.5 text-center">
            <div
              className="flex cursor-help flex-col items-center gap-1"
              title={`${criterion.name} · ${criterion.citation}`}
            >
              <span className="text-[8px] font-medium normal-case leading-none text-[var(--muted)]">
                {criterion.legalCode.replace(/[()]/g, "")}
              </span>
              <span className="text-[9px] font-semibold normal-case leading-none text-[var(--foreground)]">
                {criterion.shortLabel}
              </span>
            </div>
          </th>
        ))}
        <th className="px-1 py-2.5 text-center">Conf</th>
        <th className="px-1 py-2.5 text-center">Ref</th>
        <th className="px-1 py-2.5 text-center">Arch</th>
      </tr>
    </thead>
  );
}
