import { EvidenceWorkbench } from "@/components/evidence-workbench";
import { buildLibrarySnapshot } from "@/lib/library";

export default async function Home() {
  const snapshot = await buildLibrarySnapshot();

  return <EvidenceWorkbench initialSnapshot={snapshot} pageMode="dashboard" />;
}
