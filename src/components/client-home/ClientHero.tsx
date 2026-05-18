interface ClientHeroProps {
  displayName: string;
  petitionSummary: string;
  statusLabel: string;
  filingTargetLabel: string | null;
}

export function ClientHero({
  displayName,
  petitionSummary,
  statusLabel,
  filingTargetLabel,
}: ClientHeroProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {displayName}
        </h1>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--brand-deep)]">
          <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
          {statusLabel}
        </span>
        {filingTargetLabel ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)] lg:ml-auto">
            Filing target · {filingTargetLabel}
          </span>
        ) : null}
      </div>
      <p className="max-w-4xl text-[13px] leading-6 text-[var(--muted)]">{petitionSummary}</p>
    </div>
  );
}
