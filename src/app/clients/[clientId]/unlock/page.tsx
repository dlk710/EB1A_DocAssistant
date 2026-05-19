import { notFound } from "next/navigation";
import { UnlockWorkspace } from "@/components/lock/UnlockWorkspace";
import { getClient } from "@/lib/clients";
import { getLockedStrategy, listCriterionDrafts } from "@/lib/lock";

interface ClientUnlockPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export default async function ClientUnlockPage({ params }: ClientUnlockPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  return (
    <UnlockWorkspace
      clientId={clientId}
      clientName={client.displayName}
      lockedStrategy={getLockedStrategy(clientId)}
      drafts={listCriterionDrafts(clientId)}
    />
  );
}
