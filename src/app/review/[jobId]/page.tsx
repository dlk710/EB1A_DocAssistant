import { EvidenceWorkbench } from "@/components/evidence-workbench";
import { buildLibrarySnapshot } from "@/lib/library";

interface ReviewPageProps {
  params: Promise<{
    jobId: string;
  }>;
}

export default async function WorkspaceReviewPage({ params }: ReviewPageProps) {
  const { jobId } = await params;
  const snapshot = await buildLibrarySnapshot({ jobId });

  return <EvidenceWorkbench initialSnapshot={snapshot} pageMode="review" />;
}
