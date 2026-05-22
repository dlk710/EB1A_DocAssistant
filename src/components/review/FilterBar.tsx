"use client";

import { SearchIcon } from "@/components/review/grid-icons";
import type { EvidenceGridFilters } from "@/components/review/evidence-grid-types";
import type { EvidenceGridBundleOption } from "@/lib/evidence-query";
import { EB1A_CRITERIA_DEFINITIONS } from "@/lib/constants";

interface FilterBarProps {
  filters: EvidenceGridFilters;
  onChange: (next: EvidenceGridFilters) => void;
  bundleOptions: EvidenceGridBundleOption[];
  workspaceOptions: Array<{ id: string; name: string }>;
}

export function FilterBar({
  filters,
  onChange,
  bundleOptions,
  workspaceOptions,
}: FilterBarProps) {
  return (
    <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,0.8fr))_auto]">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Search filename, summary, or path"
            className="w-full rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-10 py-2.5 text-[12px] text-[var(--foreground)] outline-none"
          />
        </label>

        <select
          value={filters.workspaceId}
          onChange={(event) => onChange({ ...filters, workspaceId: event.target.value })}
          className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]"
        >
          <option value="">All workspaces</option>
          {workspaceOptions.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>

        <select
          value={filters.bundleId}
          onChange={(event) => onChange({ ...filters, bundleId: event.target.value })}
          className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]"
        >
          <option value="">All bundles</option>
          {bundleOptions.map((bundle) => (
            <option key={bundle.id} value={bundle.id}>
              {bundle.name}
            </option>
          ))}
        </select>

        <select
          value={filters.criterionCode}
          onChange={(event) => onChange({ ...filters, criterionCode: event.target.value })}
          className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]"
        >
          <option value="">All criteria</option>
          {EB1A_CRITERIA_DEFINITIONS.map((criterion) => (
            <option key={criterion.code} value={criterion.code}>
              {criterion.shortLabel}
            </option>
          ))}
        </select>

        <select
          value={filters.disposition}
          onChange={(event) => onChange({ ...filters, disposition: event.target.value })}
          className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2.5 text-[12px] text-[var(--foreground)]"
        >
          <option value="">All dispositions</option>
          <option value="untouched">Untouched</option>
          <option value="tagged">Tagged</option>
          <option value="reference">Reference</option>
          <option value="archived">Archived</option>
        </select>

        <button
          type="button"
          onClick={() => onChange({ ...filters, aiUnsure: !filters.aiUnsure })}
          className={`rounded-[12px] border px-3 py-2.5 text-[12px] font-medium ${
            filters.aiUnsure
              ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-deep)]"
              : "border-[var(--border-primary)] bg-[var(--paper-primary)] text-[var(--foreground)]"
          }`}
        >
          AI unsure
        </button>

        <button
          type="button"
          onClick={() =>
            onChange({
              workspaceId: "",
              bundleId: "",
              criterionCode: "",
              disposition: "",
              aiUnsure: false,
              search: "",
            })
          }
          className="rounded-[12px] border border-[var(--border-primary)] bg-[var(--paper-secondary)] px-3 py-2.5 text-[12px] font-medium text-[var(--foreground)]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
