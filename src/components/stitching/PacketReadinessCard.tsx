"use client";

import type { AssembledPetition } from "@/lib/types";

export function PacketReadinessCard(props: { packet: AssembledPetition }) {
  const blocking = props.packet.findings.filter((finding) => finding.severity === "blocking").length;
  const warnings = props.packet.findings.filter((finding) => finding.severity === "warning").length;
  const readySections = props.packet.sections.length - blocking;
  const progress = props.packet.sections.length
    ? Math.max(0, Math.min(100, Math.round((readySections / props.packet.sections.length) * 100)))
    : 0;

  return (
    <div className="rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Packet readiness
          </p>
          <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            {blocking ? "Blocking findings remain" : "Packet can be generated"}
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-[var(--muted)]">
            {props.packet.sections.length} sections · {blocking} blocking · {warnings} warning
            {warnings === 1 ? "" : "s"} · {props.packet.totalPages} estimated pages
          </p>
        </div>
        <div className="min-w-[220px] flex-1 max-w-[320px]">
          <div className="h-3 rounded-full bg-[var(--paper-secondary)]">
            <div
              className={`h-3 rounded-full ${blocking ? "bg-[var(--state-warning)]" : "bg-[var(--state-success)]"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {progress}% of section flow is review-ready
          </p>
        </div>
      </div>
    </div>
  );
}
