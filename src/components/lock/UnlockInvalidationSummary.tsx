import type { CriterionDraft, LockedCaseStrategy } from "@/lib/types";

export function UnlockInvalidationSummary(props: {
  lockedStrategy: LockedCaseStrategy | null;
  drafts: CriterionDraft[];
}) {
  if (!props.lockedStrategy) {
    return (
      <section className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
        <p className="text-[12px] text-[var(--muted)]">This client does not currently have a locked strategy.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Unlock impact
        </p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          Unlock will preserve drafts but mark dependent work out-of-date
        </h1>
      </div>
      <div className="rounded-[16px] bg-[var(--state-warning-soft)] px-4 py-4 text-[12px] leading-6 text-[var(--state-warning)]">
        Unlock will affect {props.drafts.length} draft
        {props.drafts.length === 1 ? "" : "s"} tied to the current criteria mix.
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[16px] bg-[var(--paper-secondary)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Locked criteria
          </p>
          <ul className="mt-3 space-y-2 text-[12px] leading-6 text-[var(--foreground)]">
            {[...props.lockedStrategy.primary, ...props.lockedStrategy.supporting].map((entry) => (
              <li key={`${entry.role}-${entry.criterionCode}`}>
                {entry.legalCode} {entry.criterionName}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[16px] bg-[var(--paper-secondary)] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Drafts in progress
          </p>
          <ul className="mt-3 space-y-2 text-[12px] leading-6 text-[var(--foreground)]">
            {props.drafts.length ? (
              props.drafts.map((draft) => (
                <li key={draft.criterionCode}>
                  {draft.criterionCode} · {draft.status}
                  {draft.outOfDate ? " · out-of-date" : ""}
                </li>
              ))
            ) : (
              <li>No drafts exist yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
