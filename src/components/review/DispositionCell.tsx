"use client";

import { ArchiveIcon, BookmarkIcon } from "@/components/review/grid-icons";

interface DispositionCellProps {
  kind: "reference" | "archived";
  active: boolean;
  onToggle: () => void;
}

export function DispositionCell({
  kind,
  active,
  onToggle,
}: DispositionCellProps) {
  const isArchive = kind === "archived";
  const Icon = isArchive ? ArchiveIcon : BookmarkIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border transition ${
        active
          ? isArchive
            ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white"
            : "border-[var(--brand)] bg-[var(--brand)] text-white"
          : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)]"
      }`}
      title={isArchive ? "Archive document" : "Mark as reference"}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
