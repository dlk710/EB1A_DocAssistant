export function ReasoningExpansion(props: { reasoning: string; droppedClaims?: string[] }) {
  return (
    <details className="rounded-[14px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-3 py-2.5">
      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Show reasoning
      </summary>
      <p className="mt-3 whitespace-pre-wrap text-[11px] leading-6 text-[var(--muted)]">
        {props.reasoning}
      </p>
      {props.droppedClaims?.length ? (
        <div className="mt-3 rounded-[12px] bg-[var(--state-warning-soft)] px-3 py-2 text-[11px] leading-5 text-[var(--state-warning)]">
          <p className="font-semibold">Dropped claims</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {props.droppedClaims.map((claim, index) => (
              <li key={`${claim.slice(0, 20)}-${index}`}>{claim}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}
