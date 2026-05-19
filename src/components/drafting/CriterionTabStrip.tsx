"use client";

import Link from "next/link";

interface CriterionTab {
  criterionCode: string;
  legalCode: string;
  name: string;
  href: string;
  status: "approved" | "in-progress" | "not-started" | "out-of-date";
  versionLabel?: string | null;
  active?: boolean;
}

function statusLabel(tab: CriterionTab) {
  if (tab.status === "approved") {
    return "approved";
  }
  if (tab.status === "out-of-date") {
    return "out of date";
  }
  return tab.versionLabel || (tab.status === "in-progress" ? "in progress" : "not started");
}

export function CriterionTabStrip(props: { tabs: CriterionTab[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.tabs.map((tab) => (
        <Link
          key={tab.criterionCode}
          href={tab.href}
          className={`rounded-[14px] border px-3 py-2 transition ${
            tab.active
              ? "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white"
              : tab.status === "approved"
                ? "border-[var(--state-success)]/20 bg-[var(--state-success-soft)] text-[var(--state-success)]"
                : tab.status === "out-of-date"
                  ? "border-[var(--state-warning)]/20 bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
                  : "border-[var(--border-secondary)] bg-[var(--paper-primary)] text-[var(--foreground)]"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
            {tab.legalCode}
          </p>
          <p className="mt-1 text-[12px] font-semibold">{tab.name}</p>
          <p className={`mt-1 text-[10px] ${tab.active ? "text-white/72" : "text-current/72"}`}>
            {statusLabel(tab)}
          </p>
        </Link>
      ))}
    </div>
  );
}
