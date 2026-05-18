import { EvidenceWorkbench } from "@/components/evidence-workbench";
import { listClients } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { redirect } from "next/navigation";

interface HomePageProps {
  searchParams?: Promise<{
    view?: string;
    clientId?: string;
  }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const view = params.view;
  const clientId = params.clientId;

  if (view === "workspace") {
    const snapshot = await buildLibrarySnapshot({ clientId });

    return <EvidenceWorkbench initialSnapshot={snapshot} pageMode="dashboard" />;
  }

  const clients = listClients();

  if (!clients.length) {
    const snapshot = await buildLibrarySnapshot();

    return <EvidenceWorkbench initialSnapshot={snapshot} pageMode="dashboard" />;
  }

  if (clients.length === 1) {
    redirect(`/clients/${clients[0].id}`);
  }

  redirect("/clients");
}
