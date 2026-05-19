import { notFound, redirect } from "next/navigation";
import { DraftingWorkspace } from "@/components/drafting/DraftingWorkspace";
import { getClient } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { ensureCriterionDraft, listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { getCriterionPinboard } from "@/lib/pinboards";

interface CriterionDraftingPageProps {
  params: Promise<{
    clientId: string;
    criterionCode: string;
  }>;
}

function tabStatus(draft: ReturnType<typeof ensureCriterionDraft>) {
  if (draft?.status === "out-of-date") {
    return {
      status: "out-of-date" as const,
      versionLabel: draft.versions.length
        ? `v${draft.versions.at(-1)?.version} · out of date`
        : "out of date",
    };
  }
  if (!draft || !draft.versions.length) {
    return {
      status: "not-started" as const,
      versionLabel: "not started",
    };
  }
  if (draft.status === "approved") {
    return {
      status: "approved" as const,
      versionLabel: `v${draft.latestApprovedVersion} approved`,
    };
  }
  return {
    status: "in-progress" as const,
    versionLabel: `v${draft.versions.at(-1)?.version} · in progress`,
  };
}

export default async function CriterionDraftingPage({ params }: CriterionDraftingPageProps) {
  const { clientId, criterionCode } = await params;
  const client = getClient(clientId);
  if (!client) {
    notFound();
  }

  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    redirect(`/clients/${clientId}/lock`);
  }

  const criterionEntry = [...lockedStrategy.primary, ...lockedStrategy.supporting].find(
    (entry) => entry.criterionCode === criterionCode,
  );
  if (!criterionEntry) {
    notFound();
  }

  const draft = ensureCriterionDraft(clientId, criterionCode);
  const snapshot = await buildLibrarySnapshot({ clientId });
  const pinboard = getCriterionPinboard(clientId, criterionCode);
  const draftByCode = new Map(listCriterionDrafts(clientId).map((entry) => [entry.criterionCode, entry]));
  const documentLookup = new Map(snapshot.clientDocuments.map((document) => [document.id, document]));
  const tabs = [...lockedStrategy.primary, ...lockedStrategy.supporting].map((entry) => {
    const currentDraft = draftByCode.get(entry.criterionCode) ?? ensureCriterionDraft(clientId, entry.criterionCode);
    const status = tabStatus(currentDraft);
    return {
      criterionCode: entry.criterionCode,
      legalCode: entry.legalCode,
      name: entry.criterionName,
      href: `/clients/${clientId}/drafting/${entry.criterionCode}`,
      active: entry.criterionCode === criterionCode,
      ...status,
    };
  });

  const pinboardEntries = (pinboard?.entries ?? []).map((entry) => {
    const document = documentLookup.get(entry.documentId);
    return {
      ...entry,
      title: document?.summary?.title || document?.fileName || entry.documentId,
      fileName: document?.fileName || entry.documentId,
    };
  });

  const suggestedDocuments = snapshot.clientDocuments
    .filter(
      (document) =>
        document.criteriaTags.some((tag) => tag.code === criterionCode) &&
        !pinboardEntries.some((entry) => entry.documentId === document.id),
    )
    .slice(0, 10)
    .map((document) => ({
      id: document.id,
      title: document.summary?.title || document.fileName,
      fileName: document.fileName,
    }));

  return (
    <DraftingWorkspace
      clientId={clientId}
      clientName={client.displayName}
      criterionCode={criterionCode}
      criterionName={criterionEntry.criterionName}
      criterionLegalCode={criterionEntry.legalCode}
      tabs={tabs}
      draft={draft!}
      pinboardEntries={pinboardEntries}
      suggestedDocuments={suggestedDocuments}
      strategyRationale={criterionEntry.rationale}
      narrativeSpine={lockedStrategy.narrativeSpine}
      anchorExhibits={criterionEntry.anchorExhibits.map((assignment) => assignment.exhibitLabel)}
    />
  );
}
