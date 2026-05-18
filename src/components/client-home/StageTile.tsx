import Link from "next/link";

type StageTileState = "done" | "active" | "locked";

interface StageTileProps {
  number: number;
  title: string;
  description: string;
  state: StageTileState;
  href?: string | null;
  badge: string;
  disabledReason?: string;
}

function tileClassName(state: StageTileState) {
  if (state === "active") {
    return "border-[var(--brand-charcoal)] bg-[var(--brand-charcoal)] text-white";
  }

  if (state === "done") {
    return "border-[var(--border-secondary)] bg-[var(--paper-primary)] text-[var(--foreground)]";
  }

  return "border-[var(--border-secondary)] bg-[var(--paper-tertiary)] text-[var(--muted)]";
}

function numberClassName(state: StageTileState) {
  if (state === "active") {
    return "bg-[var(--brand)] text-[var(--brand-charcoal-deep)]";
  }

  if (state === "done") {
    return "bg-[var(--paper-secondary)] text-[var(--foreground)]";
  }

  return "bg-[var(--paper-primary)] text-[var(--muted)]";
}

function badgeClassName(state: StageTileState) {
  if (state === "active") {
    return "bg-[var(--brand-soft)] text-[var(--brand-deep)]";
  }

  if (state === "done") {
    return "bg-[var(--state-success-soft)] text-[var(--state-success)]";
  }

  return "bg-[var(--paper-primary)] text-[var(--muted)]";
}

export function StageTile({
  number,
  title,
  description,
  state,
  href,
  badge,
  disabledReason,
}: StageTileProps) {
  const content = (
    <div className={`rounded-[16px] border px-4 py-4 transition ${tileClassName(state)}`}>
      <div className="flex items-start gap-4">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[18px] font-semibold ${numberClassName(
            state,
          )}`}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[15px] font-semibold">{title}</p>
              <p
                className={`mt-1 text-[12px] leading-6 ${
                  state === "active" ? "text-white/78" : "text-[var(--muted)]"
                }`}
              >
                {description}
              </p>
            </div>
            <span
              className={`inline-flex self-start rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${badgeClassName(
                state,
              )}`}
            >
              {badge}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (href && state !== "locked") {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <div title={disabledReason} aria-disabled={state === "locked"}>
      {content}
    </div>
  );
}
