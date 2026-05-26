"use client";

import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

export function GridHeader() {
  return (
    <thead className="sticky top-0 z-20 bg-[var(--paper-primary)] shadow-[0_1px_0_var(--border-secondary)]">
      <tr className="text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        <th className="px-2 py-3 align-bottom">Sel</th>
        <th className="px-2 py-3 align-bottom">Document</th>
        {EB1A_CRITERIA_DEFINITIONS.map((criterion) => (
          <th key={criterion.code} className="px-0.5 py-2 text-center align-bottom">
            <div
              className="relative mx-auto h-[102px] w-[40px] cursor-help overflow-visible"
              title={`${criterion.name} · ${criterion.citation}`}
            >
              <span className="absolute bottom-[4px] left-[10px] inline-flex origin-bottom-left -rotate-[63deg] items-center gap-1 whitespace-nowrap leading-none">
                <span className="text-[8px] font-medium normal-case text-[var(--muted)]">
                  {criterion.legalCode.replace(/[()]/g, "")}
                </span>
                <span className="text-[11px] font-semibold normal-case text-[var(--foreground)]">
                  {criterion.shortLabel}
                </span>
              </span>
            </div>
          </th>
        ))}
        <th className="px-1 py-3 text-center align-bottom">Conf</th>
        <th className="px-1 py-3 text-center align-bottom">Ref</th>
        <th className="px-1 py-3 text-center align-bottom">Arch</th>
      </tr>
    </thead>
  );
}
