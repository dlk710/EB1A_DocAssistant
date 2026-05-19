"use client";

import { FindingCard } from "@/components/stitching/FindingCard";
import type { AuditFinding } from "@/lib/types";

export function FindingsList(props: { findings: AuditFinding[] }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Findings
        </p>
        <h2 className="mt-2 text-[18px] font-semibold text-[var(--foreground)]">
          Audit surface
        </h2>
      </div>
      <div className="space-y-3">
        {props.findings.length ? (
          props.findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)
        ) : (
          <div className="rounded-[16px] border border-[var(--state-success)]/20 bg-[var(--state-success-soft)] px-4 py-4 text-[12px] leading-6 text-[var(--state-success)]">
            No blocking or warning findings remain. The packet is ready for export.
          </div>
        )}
      </div>
    </section>
  );
}
