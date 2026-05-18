import Link from "next/link";
import { redirect } from "next/navigation";
import { listClients } from "@/lib/clients";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ClientsPage() {
  const clients = listClients();

  if (!clients.length) {
    redirect("/?view=workspace");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1480px]">
        <header className="setu-topbar rounded-[18px] px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <span className="setu-wordmark" aria-label="setu">
                  <span className="setu-wordmark-letters">setu</span>
                  <span className="setu-wordmark-deck" aria-hidden="true" />
                </span>
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>Client portfolio</span>
                </span>
              </div>
              <div className="space-y-1">
                <p className="setu-brand-tagline">Case lifecycle, organized around the client.</p>
                <p className="setu-brand-meta">
                  Each client owns one or more evidence workspaces. Open a client to review
                  onboarding, human review, and the later strategy stages.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/?view=workspace"
                className="setu-primary-button inline-flex items-center rounded-[8px] px-4 py-2.5 text-[11px] font-semibold text-white"
              >
                Start a new client intake
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[20px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Clients
              </p>
              <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Open a case and pick up where the review left off
              </h1>
            </div>
            <p className="max-w-2xl text-[12px] leading-6 text-[var(--muted)]">
              The client view sits above the existing workspace pipeline. Indexing, bundling,
              classification, and tagging all continue to run inside each workspace.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="group rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-tertiary)] px-4 py-4 transition hover:border-[var(--brand)]/25 hover:bg-[var(--paper-primary)]"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--paper-primary)] text-[18px] font-semibold text-[var(--brand-deep)]">
                    {client.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[16px] font-semibold text-[var(--foreground)]">
                          {client.displayName}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {client.petitionType} · updated {formatDateTime(client.updatedAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--paper-primary)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                        {client.status.replaceAll("-", " ")}
                      </span>
                    </div>
                    <p className="mt-4 text-[12px] leading-6 text-[var(--muted)]">
                      Open the client home to see blocking actions, coverage, spend, and the
                      action-items review surface.
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
