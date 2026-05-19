import { notFound } from "next/navigation";
import { LockWorkspace } from "@/components/lock/LockWorkspace";
import { getLatestStrategyMemo, listChatArtifacts } from "@/lib/chat-state";
import { getClient } from "@/lib/clients";

interface ClientLockPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export default async function ClientLockPage({ params }: ClientLockPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  return (
    <LockWorkspace
      clientId={clientId}
      clientName={client.displayName}
      strategyMemo={getLatestStrategyMemo(clientId)}
      pinnedArtifacts={listChatArtifacts(clientId)}
    />
  );
}
