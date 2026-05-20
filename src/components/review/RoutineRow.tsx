import type { MouseEvent } from "react";
import Link from "next/link";

interface RoutineRowProps {
  label: string;
  count: number;
  samples: string[];
  href: string | null;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

export function RoutineRow({ label, count, samples, href, onContextMenu }: RoutineRowProps) {
  return (
    <div
      onContextMenu={onContextMenu}
      className={`flex flex-col gap-3 rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-3 py-3 lg:flex-row lg:items-center lg:justify-between ${
        onContextMenu ? "cursor-context-menu" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--foreground)]">
          {count} {label}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
          {samples.length
            ? samples.join(", ")
            : "Open the dense workbench when you want to spot-check the routine work."}
        </p>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center rounded-full border border-[var(--border-primary)] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]"
        >
          Review →
        </Link>
      ) : null}
    </div>
  );
}
