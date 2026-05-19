"use client";

import Link from "next/link";
import { useState } from "react";
import type { StyleProfile } from "@/lib/types";

export function ProfileList(props: {
  profiles: StyleProfile[];
  activeStyleProfileId: string;
  onActivate: (profileId: string) => Promise<void>;
  onCreate: (displayName: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          New profile
        </p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Attorney voice · 2026"
            className="flex-1 rounded-[12px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[12px] text-[var(--foreground)] outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              if (!displayName.trim()) {
                return;
              }
              setIsSaving(true);
              try {
                await props.onCreate(displayName.trim());
                setDisplayName("");
              } finally {
                setIsSaving(false);
              }
            }}
            className="setu-primary-button rounded-[10px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
          >
            {isSaving ? "Creating…" : "Create profile"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {props.profiles.map((profile) => (
          <div
            key={profile.id}
            className="rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-[var(--foreground)]">{profile.displayName}</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {profile.exemplars.length} exemplar{profile.exemplars.length === 1 ? "" : "s"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                  props.activeStyleProfileId === profile.id
                    ? "bg-[var(--brand-soft)] text-[var(--brand-deep)]"
                    : "bg-[var(--paper-secondary)] text-[var(--muted)]"
                }`}
              >
                {props.activeStyleProfileId === profile.id ? "Active" : profile.isDefault ? "Default" : "Saved"}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/settings/style-profiles/${profile.id}`}
                className="rounded-[10px] border border-[var(--border-primary)] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
              >
                Open
              </Link>
              <button
                type="button"
                onClick={() => void props.onActivate(profile.id)}
                className="rounded-[10px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-deep)]"
              >
                Use profile
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
