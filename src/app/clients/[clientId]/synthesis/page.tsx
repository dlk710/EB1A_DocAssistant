import { notFound, redirect } from "next/navigation";
import { countApproved } from "@/lib/approval";
import { SynthesisWorkspace } from "@/components/synthesis/SynthesisWorkspace";
import { getClient, getSynthesisLifecycleStatus, updateClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { buildLibrarySnapshot } from "@/lib/library";
import { getLockedStrategy } from "@/lib/lock";
import { listSynthesisDrafts } from "@/lib/synthesis";
import type { SynthesisSectionKind } from "@/lib/types";

interface ClientSynthesisPageProps {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ kind?: string }>;
}

function tabStatus(status: string, versionCount: number) {
  if (status === "approved") {
    return "approved" as const;
  }
  if (status === "out-of-date") {
    return "out-of-date" as const;
  }
  return versionCount > 0 ? ("in-progress" as const) : ("not-started" as const);
}

export default async function ClientSynthesisPage({
  params,
  searchParams,
}: ClientSynthesisPageProps) {
  const { clientId } = await params;
  const { kind } = await searchParams;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    redirect(`/clients/${clientId}/lock`);
  }

  const drafts = listCriterionDrafts(
    clientId,
    [...lockedStrategy.primary, ...lockedStrategy.supporting].map((entry) => entry.criterionCode),
  );
  const approvedDraftCount = countApproved(drafts);
  const claimedCriteriaCount = drafts.length;
  const synthesisDrafts = listSynthesisDrafts(clientId);
  const approvedSynthesisCount = countApproved(synthesisDrafts);

  const derivedStatus = getSynthesisLifecycleStatus({
    locked: true,
    claimedCriteriaCount,
    approvedCriteriaCount: approvedDraftCount,
    approvedSynthesisCount,
  });

  if (client.status !== derivedStatus) {
    updateClient(clientId, { status: derivedStatus });
  }

  if (approvedDraftCount < claimedCriteriaCount) {
    redirect(`/clients/${clientId}/drafting`);
  }

  const snapshot = await buildLibrarySnapshot({ clientId });
  const selectedKind: SynthesisSectionKind =
    kind === "final-merits-determination" ? "final-merits-determination" : "statement-of-eligibility";
  const synthesisByKind = {
    "statement-of-eligibility":
      synthesisDrafts.find((draft) => draft.kind === "statement-of-eligibility") ?? null,
    "final-merits-determination":
      synthesisDrafts.find((draft) => draft.kind === "final-merits-determination") ?? null,
  } satisfies Record<SynthesisSectionKind, (typeof synthesisDrafts)[number] | null>;

  const approvedDrafts = [...lockedStrategy.primary, ...lockedStrategy.supporting]
    .map((entry) => {
      const draft = drafts.find((candidate) => candidate.criterionCode === entry.criterionCode);
      const approvedVersion = draft?.versions.find(
        (version) => version.version === draft.latestApprovedVersion,
      );
      if (!draft || !approvedVersion) {
        return null;
      }
      return {
        draftId: draft.id || `${clientId}:${entry.criterionCode}`,
        criterionCode: entry.criterionCode,
        legalCode: entry.legalCode,
        criterionName: entry.criterionName,
        approvedVersion: approvedVersion.version,
        excerpt: approvedVersion.paragraphs[0]?.text || "",
        fullText: approvedVersion.paragraphs.map((paragraph) => paragraph.text).join("\n\n"),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const tabs = [
    {
      kind: "statement-of-eligibility" as const,
      label: "Statement of Eligibility",
      status: tabStatus(
        synthesisByKind["statement-of-eligibility"]?.status ?? "in-progress",
        synthesisByKind["statement-of-eligibility"]?.versions.length ?? 0,
      ),
      versionLabel:
        synthesisByKind["statement-of-eligibility"]?.versions.length
          ? `v${synthesisByKind["statement-of-eligibility"]?.versions.at(-1)?.version} · ${synthesisByKind["statement-of-eligibility"]?.status.replaceAll("-", " ")}`
          : "Not started",
    },
    {
      kind: "final-merits-determination" as const,
      label: "Final Merits Determination",
      status: tabStatus(
        synthesisByKind["final-merits-determination"]?.status ?? "in-progress",
        synthesisByKind["final-merits-determination"]?.versions.length ?? 0,
      ),
      versionLabel:
        synthesisByKind["final-merits-determination"]?.versions.length
          ? `v${synthesisByKind["final-merits-determination"]?.versions.at(-1)?.version} · ${synthesisByKind["final-merits-determination"]?.status.replaceAll("-", " ")}`
          : "Not started",
    },
  ];

  return (
    <SynthesisWorkspace
      clientId={clientId}
      clientName={client.displayName}
      workspaceCount={snapshot.clientWorkspaces.length}
      initialKind={selectedKind}
      drafts={synthesisByKind}
      approvedDrafts={approvedDrafts}
      tabs={tabs}
      leadNarrative={lockedStrategy.narrativeSpine}
    />
  );
}
