export function LockHero(props: {
  onLock: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}) {
  return (
    <section className="rounded-[24px] bg-[var(--brand-charcoal)] px-5 py-5 text-white shadow-[0_24px_50px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Lock
          </p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-white">
            Lock the case theory
          </h1>
          <p className="mt-3 text-[13px] leading-7 text-white/76">
            Locking commits the criteria mix, generates stable exhibit numbers, and unlocks the
            later drafting path. Unlocking is allowed later, but it will flag dependent drafts as
            out-of-date.
          </p>
        </div>
        <button
          type="button"
          onClick={props.onLock}
          disabled={props.disabled || props.isSubmitting}
          className="inline-flex items-center rounded-[10px] bg-[var(--brand)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-charcoal-deep)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {props.isSubmitting ? "Locking…" : "Lock now"}
        </button>
      </div>
    </section>
  );
}
