"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExemplarCard } from "@/components/style-profiles/ExemplarCard";
import { ExemplarEditor } from "@/components/style-profiles/ExemplarEditor";
import type { StyleExemplar, StyleProfile } from "@/lib/types";

export default function StyleProfileEditorPage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [editingExemplar, setEditingExemplar] = useState<StyleExemplar | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) {
      return;
    }
    fetch(`/api/style-profiles/${params.id}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.profile) {
          throw new Error(payload.error || "Unable to load style profile.");
        }
        setProfile(payload.profile);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load style profile.");
      });
  }, [params]);

  return (
    <div className="min-h-screen bg-[var(--background)] px-3 py-4 xl:px-4">
      <div className="mx-auto max-w-[1380px]">
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
                  <span>{profile?.displayName || "Style profile"}</span>
                </span>
              </div>
            </div>
            <Link
              href="/settings/style-profiles"
              className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border-primary)] bg-[var(--paper-primary)] px-3 py-2 text-[11px] font-medium text-[var(--foreground)]"
            >
              Back to profiles
            </Link>
          </div>
        </header>

        <div className="mt-5 space-y-4">
          {errorMessage ? (
            <div className="rounded-[16px] border border-[var(--state-danger)]/20 bg-[var(--state-danger-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--state-danger)]">
              {errorMessage}
            </div>
          ) : null}

          {(isCreating || editingExemplar) && params?.id ? (
            <ExemplarEditor
              key={editingExemplar?.id || "new"}
              exemplar={editingExemplar}
              onCancel={() => {
                setEditingExemplar(null);
                setIsCreating(false);
              }}
              onSave={async (input) => {
                const method = editingExemplar ? "PATCH" : "POST";
                const url = editingExemplar
                  ? `/api/style-profiles/${params.id}/exemplars/${editingExemplar.id}`
                  : `/api/style-profiles/${params.id}/exemplars`;
                const response = await fetch(url, {
                  method,
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(input),
                });
                const payload = (await response.json()) as { profile?: StyleProfile; error?: string };
                if (!response.ok || !payload.profile) {
                  throw new Error(payload.error || "Unable to save exemplar.");
                }
                setProfile(payload.profile);
                setEditingExemplar(null);
                setIsCreating(false);
              }}
            />
          ) : null}

          {profile ? (
            <section className="space-y-4 rounded-[18px] border border-[var(--border-secondary)] bg-[var(--paper-primary)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Exemplars
                  </p>
                  <p className="mt-1 text-[12px] leading-6 text-[var(--muted)]">
                    {profile.isDefault
                      ? "The default profile is read-only."
                      : "Add the attorney’s strongest approved petition prose as reference style, including Statement of Eligibility and Final Merits examples."}
                  </p>
                </div>
                {!profile.isDefault ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExemplar(null);
                      setIsCreating(true);
                    }}
                    className="setu-primary-button rounded-[10px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                  >
                    Add exemplar
                  </button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {profile.exemplars.map((exemplar) => (
                  <ExemplarCard
                    key={exemplar.id}
                    exemplar={exemplar}
                    readOnly={profile.isDefault}
                    onEdit={(nextExemplar) => setEditingExemplar(nextExemplar)}
                    onDelete={async (exemplarId) => {
                      if (!params?.id) {
                        return;
                      }
                      const response = await fetch(
                        `/api/style-profiles/${params.id}/exemplars/${exemplarId}`,
                        { method: "DELETE" },
                      );
                      const payload = (await response.json()) as { profile?: StyleProfile; error?: string };
                      if (!response.ok || !payload.profile) {
                        throw new Error(payload.error || "Unable to delete exemplar.");
                      }
                      setProfile(payload.profile);
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
