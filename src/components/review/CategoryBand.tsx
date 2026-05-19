"use client";

import type { ReactNode } from "react";
import { useState } from "react";

interface CategoryBandProps {
  legalCode: string;
  title: string;
  taggedCount: number;
  decisionCount: number;
  routineCount: number;
  note?: string | null;
  defaultOpen?: boolean;
  headerClassName?: string;
  headerChipClassName?: string;
  children: ReactNode;
}

export function CategoryBand({
  legalCode,
  title,
  taggedCount,
  decisionCount,
  routineCount,
  note,
  defaultOpen = false,
  headerClassName,
  headerChipClassName,
  children,
}: CategoryBandProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-start gap-3 px-4 py-4 text-left ${headerClassName ?? ""}`}
      >
        <span className="mt-1 text-[11px] font-semibold text-[var(--muted)]">
          {open ? "▾" : "▸"}
        </span>
        <span
          className={`rounded-full bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] ${
            headerChipClassName ?? ""
          }`}
        >
          {legalCode}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[14px] font-semibold text-[var(--foreground)]">{title}</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                {taggedCount} tagged document(s)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {decisionCount > 0 ? (
                <span className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
                  {decisionCount} decision{decisionCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {routineCount > 0 ? (
                <span className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {routineCount} routine
                </span>
              ) : null}
            </div>
          </div>
          {note ? <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">{note}</p> : null}
        </div>
      </button>
      {open ? <div className="space-y-3 border-t border-[var(--border-secondary)] px-4 py-4">{children}</div> : null}
    </div>
  );
}
