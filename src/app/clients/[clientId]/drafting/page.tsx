import { notFound, redirect } from "next/navigation";
import { DraftingOverview } from "@/components/drafting/DraftingOverview";
import { getClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";

interface ClientDraftingPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export default async function ClientDraftingPage({ params }: ClientDraftingPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    redirect(`/clients/${clientId}/lock`);
  }

  const drafts = listCriterionDrafts(clientId);
  const draftByCode = new Map(drafts.map((draft) => [draft.criterionCode, draft]));
  const entries = [...lockedStrategy.primary, ...lockedStrategy.supporting].map((entry) => {
    const draft = draftByCode.get(entry.criterionCode);
    const status: "approved" | "in-progress" | "not-started" | "out-of-date" =
      draft?.status === "approved"
        ? "approved"
        : draft?.status === "out-of-date"
          ? "out-of-date"
          : draft?.versions.length
            ? "in-progress"
            : "not-started";
    return {
      criterionCode: entry.criterionCode,
      legalCode: entry.legalCode,
      name: entry.criterionName,
      href: `/clients/${clientId}/drafting/${entry.criterionCode}`,
      status,
      latestVersionLabel:
        draft?.status === "out-of-date" && !draft.versions.length
          ? "Out of date"
          : draft?.versions.length
            ? `v${draft.versions.at(-1)?.version} · ${status.replaceAll("-", " ")}`
            : "Not started",
    };
  });

  return (
    <DraftingOverview
      clientId={clientId}
      clientName={client.displayName}
      entries={entries}
    />
  );
}
