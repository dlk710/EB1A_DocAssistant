"use client";

import { ChevronDown, ChevronRight, Pin, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ChatArtifactRecord } from "@/lib/types";

function formatArtifactKind(kind: ChatArtifactRecord["kind"]) {
  if (kind === "strategy-memo") {
    return "Strategy memo";
  }

  if (kind === "stress-test-report") {
    return "Stress-test";
  }

  return "Brief draft";
}

function formatArtifactDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ArtifactShelf(props: {
  artifacts: ChatArtifactRecord[];
  selectedArtifactId: string | null;
  deletingArtifactId?: string | null;
  onSelect: (artifactId: string) => void;
  onDelete: (artifactId: string) => void;
}) {
  const [expanded, setExpanded] = useState(props.artifacts.length > 0);

  return (
    <div className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] p-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Pinned artifacts
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">
            Strategy memos, stress-tests, and later drafts pinned for this client collect here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--border-primary)] bg-white px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            {props.artifacts.length}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
          )}
        </div>
      </button>

      {expanded && props.artifacts.length ? (
        <div className="mt-3 space-y-2">
          {props.artifacts.slice(0, 6).map((artifact) => {
            const isSelected = props.selectedArtifactId === artifact.id;

            return (
              <div
                key={artifact.id}
                className={`rounded-[12px] border px-3 py-2.5 transition ${
                  isSelected
                    ? "border-[var(--brand)] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                    : "border-[var(--border-secondary)] bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => props.onSelect(artifact.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Pin className="h-3.5 w-3.5 text-[var(--brand-deep)]" />
                      <p className="truncate text-[11px] font-semibold text-[var(--foreground)]">
                        {artifact.title}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--paper-secondary)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        {formatArtifactKind(artifact.kind)}
                      </span>
                      <span className="rounded-full bg-[var(--paper-secondary)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        v{artifact.version}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {formatArtifactDate(artifact.createdAt)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onDelete(artifact.id)}
                    disabled={props.deletingArtifactId === artifact.id}
                    className="rounded-full border border-[var(--border-primary)] bg-[var(--paper-primary)] p-2 text-[var(--muted)] transition hover:bg-[var(--paper-secondary)] disabled:cursor-not-allowed disabled:opacity-45"
                    title="Unpin artifact"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : expanded ? (
        <div className="mt-3 rounded-[12px] border border-dashed border-[var(--border-primary)] px-3 py-4 text-[11px] leading-5 text-[var(--muted)]">
          Pinned strategy memos and drafts will appear here.
        </div>
      ) : null}
    </div>
  );
}
