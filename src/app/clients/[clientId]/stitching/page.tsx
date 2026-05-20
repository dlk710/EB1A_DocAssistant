import { notFound, redirect } from "next/navigation";
import { StitchingWorkspace } from "@/components/stitching/StitchingWorkspace";
import { countApproved } from "@/lib/approval";
import { buildPacketAssembly } from "@/lib/assembly";
import { getClient, getSynthesisLifecycleStatus, updateClient } from "@/lib/clients";
import { listCriterionDrafts } from "@/lib/drafts";
import { getLockedStrategy } from "@/lib/lock";
import { getSynthesisDraft } from "@/lib/synthesis";

interface ClientStitchingPageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientStitchingPage({ params }: ClientStitchingPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) {
    notFound();
  }
  const lockedStrategy = getLockedStrategy(clientId);
  if (!lockedStrategy) {
    redirect(`/clients/${clientId}/lock`);
  }

  const claimedCriteria = [...lockedStrategy.primary, ...lockedStrategy.supporting].map(
    (entry) => entry.criterionCode,
  );
  const drafts = listCriterionDrafts(clientId, claimedCriteria);
  const approvedCriteriaCount = countApproved(drafts);
  const approvedSynthesisCount = countApproved([
    getSynthesisDraft(clientId, "statement-of-eligibility"),
    getSynthesisDraft(clientId, "final-merits-determination"),
  ] as const);

  const derivedStatus = getSynthesisLifecycleStatus({
    locked: true,
    claimedCriteriaCount: claimedCriteria.length,
    approvedCriteriaCount,
    approvedSynthesisCount,
  });

  if (derivedStatus !== "stitching" && client.status !== "filed") {
    updateClient(clientId, { status: derivedStatus });
  }

  if (approvedSynthesisCount < 2) {
    redirect(`/clients/${clientId}/synthesis`);
  }

  const build = await buildPacketAssembly(clientId);

  return (
    <StitchingWorkspace
      clientId={clientId}
      clientName={client.displayName}
      petitionType={client.petitionType}
      packet={build.petition}
    />
  );
}
