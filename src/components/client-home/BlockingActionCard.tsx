import Link from "next/link";

interface BlockingActionCardProps {
  title: string;
  body: string;
  ctaLabel: string;
  href?: string | null;
  disabled?: boolean;
}

export function BlockingActionCard({
  title,
  body,
  ctaLabel,
  href,
  disabled = false,
}: BlockingActionCardProps) {
  return (
    <div className="rounded-[18px] border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--paper-primary)] text-[var(--brand-deep)]">
            <span className="text-[16px] font-semibold">1</span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
            <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">{body}</p>
          </div>
        </div>
        {href && !disabled ? (
          <Link
            href={href}
            className="setu-primary-button inline-flex items-center justify-center rounded-[8px] px-4 py-2.5 text-[11px] font-semibold text-white"
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="Available in a later phase."
            className="inline-flex items-center justify-center rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-4 py-2.5 text-[11px] font-semibold text-[var(--muted)] opacity-70"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
