interface TimelineEntry {
  id: string;
  whenLabel: string;
  summary: string;
}

interface TimelineCardProps {
  events: TimelineEntry[];
}

export function TimelineCard({ events }: TimelineCardProps) {
  return (
    <div className="setu-panel rounded-[18px] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Recent activity
      </p>
      <div className="mt-3 space-y-3">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="grid grid-cols-[60px_1fr] gap-3 text-[11px]">
              <span className="font-mono text-[var(--muted)]">{event.whenLabel}</span>
              <p className="leading-5 text-[var(--foreground)]">{event.summary}</p>
            </div>
          ))
        ) : (
          <p className="text-[12px] leading-6 text-[var(--muted)]">
            Activity will appear here as the workspace moves through intake and review.
          </p>
        )}
      </div>
    </div>
  );
}
