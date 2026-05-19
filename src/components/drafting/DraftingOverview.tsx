"use client";

import Link from "next/link";

interface DraftingOverviewEntry {
  criterionCode: string;
  legalCode: string;
  name: string;
  href: string;
  status: "approved" | "in-progress" | "not-started" | "out-of-date";
  latestVersionLabel: string;
}

export function DraftingOverview(props: {
  clientId: string;
  clientName: string;
  entries: DraftingOverviewEntry[];
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1360px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <span className="setu-wordmark" aria-label="setu">
                  <span className="setu-wordmark-letters">setu</span>
                  <span className="setu-wordmark-deck" aria-hidden="true" />
                </span>
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Drafting</span>
                </span>
              </div>
              <p className="setu-brand-tagline">
                Move criterion by criterion from locked theory to approved petition prose.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Client home
              </Link>
              <Link
                href={`/settings/style-profiles`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Style profiles
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[22px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Drafting queue
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            Approved criterion drafts ready for stitching start here
          </h1>
          <p className="mt-2 max-w-[820px] text-[13px] leading-7 text-[var(--muted)]">
            Open any claimed criterion to generate, edit, compare, and approve the argument draft. Setu keeps versions, fact-check signals, and Ask Setu Draft mode scoped to the selected criterion.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {props.entries.map((entry) => (
              <Link
                key={entry.criterionCode}
                href={entry.href}
                className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-secondary)] px-4 py-4 transition hover:border-[var(--brand)]/30 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      {entry.legalCode}
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-[var(--foreground)]">
                      {entry.name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                      entry.status === "approved"
                        ? "bg-[var(--state-success-soft)] text-[var(--state-success)]"
                        : entry.status === "out-of-date"
                          ? "bg-[var(--state-warning-soft)] text-[var(--state-warning)]"
                          : entry.status === "in-progress"
                            ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                            : "bg-[var(--paper-primary)] text-[var(--muted)]"
                    }`}
                  >
                    {entry.status.replaceAll("-", " ")}
                  </span>
                </div>
                <p className="mt-3 text-[11px] leading-6 text-[var(--muted)]">
                  {entry.latestVersionLabel}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
