import { EvidenceWorkbench } from "@/components/evidence-workbench";
import { listClients } from "@/lib/clients";
import { buildLibrarySnapshot } from "@/lib/library";
import { redirect } from "next/navigation";

interface HomePageProps {
  searchParams?: Promise<{
    view?: string;
    clientId?: string;
    jobId?: string;
  }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const view = params.view;
  const clientId = params.clientId;
  const jobId = params.jobId;

  if (view === "workspace") {
    const snapshot =
      clientId || jobId
        ? await buildLibrarySnapshot({ clientId, jobId })
        : await buildLibrarySnapshot({ suppressActiveJob: true });

    return (
      <EvidenceWorkbench
        initialSnapshot={snapshot}
        pageMode="dashboard"
        scopedClientId={clientId ?? null}
      />
    );
  }

  const clients = listClients();

  if (!clients.length) {
    const snapshot = await buildLibrarySnapshot();

    return (
      <EvidenceWorkbench
        initialSnapshot={snapshot}
        pageMode="dashboard"
        scopedClientId={null}
      />
    );
  }

  if (clients.length === 1) {
    redirect(`/clients/${clients[0].id}`);
  }

  redirect("/clients");
}
