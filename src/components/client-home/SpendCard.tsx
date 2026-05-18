interface SpendLineItem {
  label: string;
  value: number;
}

interface SpendCardProps {
  items: SpendLineItem[];
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function SpendCard({ items }: SpendCardProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="setu-panel rounded-[18px] px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        Spend
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-[12px]">
            <span className="text-[var(--muted)]">{item.label}</span>
            <span className="font-medium text-[var(--foreground)]">
              {currencyFormatter.format(item.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-secondary)] pt-3 text-[12px]">
        <span className="font-semibold text-[var(--foreground)]">Total</span>
        <span className="font-semibold text-[var(--brand-deep)]">
          {currencyFormatter.format(total)}
        </span>
      </div>
    </div>
  );
}
