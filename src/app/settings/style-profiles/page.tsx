"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProfileList } from "@/components/style-profiles/ProfileList";
import type { StyleProfile } from "@/lib/types";

export default function StyleProfilesPage() {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [activeStyleProfileId, setActiveStyleProfileId] = useState("default");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/style-profiles", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/style-profiles/active", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([profilesPayload, activePayload]) => {
        setProfiles(profilesPayload.profiles || []);
        setActiveStyleProfileId(activePayload.activeStyleProfileId || "default");
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load style profiles.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1320px]">
        <header className="setu-topbar rounded-[18px] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="setu-brand-block">
              <div className="flex flex-wrap items-center gap-4">
                <span className="setu-wordmark" aria-label="setu">
                  <span className="setu-wordmark-letters">setu</span>
                  <span className="setu-wordmark-deck" aria-hidden="true" />
                </span>
                <span className="setu-scope-chip">
                  <span className="setu-scope-dot" />
                  <span>Style profiles</span>
                </span>
              </div>
              <p className="setu-brand-tagline">
                Curate exemplar prose so Draft mode matches your petition voice.
              </p>
            </div>
            <Link
              href="/clients"
              className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
            >
              Back to clients
            </Link>
          </div>
        </header>

        <div className="mt-5 space-y-4">
          {errorMessage ? (
            <div className="rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}
          <ProfileList
            profiles={profiles}
            activeStyleProfileId={activeStyleProfileId}
            onActivate={async (profileId) => {
              const response = await fetch("/api/style-profiles/active", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ profileId }),
              });
              const payload = (await response.json()) as { profiles?: StyleProfile[]; activeStyleProfileId?: string; error?: string };
              if (!response.ok) {
                throw new Error(payload.error || "Unable to activate style profile.");
              }
              setProfiles(payload.profiles || profiles);
              setActiveStyleProfileId(payload.activeStyleProfileId || profileId);
            }}
            onCreate={async (displayName) => {
              const response = await fetch("/api/style-profiles", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ displayName }),
              });
              const payload = (await response.json()) as { profiles?: StyleProfile[]; error?: string };
              if (!response.ok) {
                throw new Error(payload.error || "Unable to create style profile.");
              }
              setProfiles(payload.profiles || []);
            }}
          />
        </div>
      </div>
    </div>
  );
}
