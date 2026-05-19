import { notFound } from "next/navigation";
import { StrategyWorkspace } from "@/components/strategy/StrategyWorkspace";
import { getLatestStressTestReport, getLatestStrategyMemo } from "@/lib/chat-state";
import { getClient } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";

interface ClientStrategyPageProps {
  params: Promise<{
    clientId: string;
  }>;
}

export default async function ClientStrategyPage({ params }: ClientStrategyPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  const snapshot = await buildLibrarySnapshot({ clientId });

  return (
    <StrategyWorkspace
      clientId={clientId}
      clientName={client.displayName}
      workspaceCount={snapshot.clientWorkspaces.length}
      coverage={snapshot.clientCoverage}
      initialMemo={getLatestStrategyMemo(clientId)}
      initialReport={getLatestStressTestReport(clientId)}
    />
  );
}
