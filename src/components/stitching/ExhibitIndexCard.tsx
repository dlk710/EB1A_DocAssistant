"use client";

import type { ExhibitIndexEntry } from "@/lib/types";

export function ExhibitIndexCard(props: { entries: ExhibitIndexEntry[] }) {
  const visible = props.entries.slice(0, 6);
  const remaining = Math.max(0, props.entries.length - visible.length);

  return (
    <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Exhibit index
      </p>
      <div className="mt-3 space-y-2">
        {visible.map((entry) => (
          <div key={`${entry.exhibitNumber}-${entry.docId}`} className="rounded-[12px] bg-[var(--paper-secondary)] px-3 py-3">
            <p className="text-[11px] font-semibold text-[var(--foreground)]">
              Ex. {entry.exhibitNumber} · {entry.title}
            </p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              {entry.bates.start} → {entry.bates.end}
            </p>
          </div>
        ))}
      </div>
      {remaining > 0 ? (
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          + {remaining} more
        </p>
      ) : null}
    </div>
  );
}
