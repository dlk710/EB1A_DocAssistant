"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SetuHomeLink } from "@/components/SetuHomeLink";
import { UnlockInvalidationSummary } from "@/components/lock/UnlockInvalidationSummary";
import type { CriterionDraft, LockedCaseStrategy } from "@/lib/types";

export function UnlockWorkspace(props: {
  clientId: string;
  clientName: string;
  lockedStrategy: LockedCaseStrategy | null;
  drafts: CriterionDraft[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleUnlock() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/clients/${props.clientId}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmed: true,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Unable to unlock the case theory.");
      }

      router.push(`/clients/${props.clientId}/strategy`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to unlock the case theory.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1280px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <SetuHomeLink />
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>{props.clientName} · Unlock</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/clients/${props.clientId}/lock`}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
              >
                Back to Lock
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 space-y-5">
          <UnlockInvalidationSummary
            lockedStrategy={props.lockedStrategy}
            drafts={props.drafts}
          />

          {errorMessage ? (
            <div className="rounded-[18px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleUnlock()}
              disabled={!props.lockedStrategy || isSubmitting}
              className="setu-primary-button inline-flex items-center rounded-[8px] px-4 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Unlocking…" : "Unlock and continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
