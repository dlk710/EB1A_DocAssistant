"use client";

import type { DraftVersion } from "@/lib/types";

export function VersionCompareModal(props: {
  open: boolean;
  leftVersion: DraftVersion | null;
  rightVersion: DraftVersion | null;
  onClose: () => void;
}) {
  if (!props.open || !props.leftVersion || !props.rightVersion) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,23,42,0.42)] p-4" onClick={props.onClose}>
      <div
        className="mx-auto flex h-full max-h-[90vh] max-w-[1200px] flex-col overflow-hidden rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Version compare
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--foreground)]">
              Compare v{props.leftVersion.version} against v{props.rightVersion.version}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
          >
            Close
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
          {[props.leftVersion, props.rightVersion].map((version) => (
            <div key={version.version} className="min-h-0 overflow-auto border-r border-[var(--border-secondary)] px-4 py-4 last:border-r-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Version {version.version} · {version.source}
              </p>
              <div className="mt-4 space-y-4">
                {version.paragraphs.map((paragraph) => (
                  <div key={paragraph.id} className="rounded-[16px] bg-[var(--paper-cream)] px-4 py-4">
                    <p className="font-serif text-[14px] leading-8 text-[var(--foreground)]">
                      {paragraph.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
