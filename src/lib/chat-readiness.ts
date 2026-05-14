import type { LibrarySnapshot } from "@/lib/types";

export interface ChatReadiness {
  ready: boolean;
  reason: string | null;
}

export function getChatReadiness(snapshot: LibrarySnapshot): ChatReadiness {
  if (!snapshot.activeJobId || !snapshot.activeJob) {
    return {
      ready: false,
      reason: "Select a folder workspace first.",
    };
  }

  if (
    snapshot.activeJob.status !== "completed" &&
    snapshot.activeJob.status !== "completed_with_errors"
  ) {
    return {
      ready: false,
      reason: "Setu finishes preparing the evidence first. The studio opens once tagging completes.",
    };
  }

  if (snapshot.overview.processingDocuments > 0) {
    return {
      ready: false,
      reason: "Setu is still indexing documents in this workspace.",
    };
  }

  if (snapshot.eventBundles?.status !== "completed") {
    return {
      ready: false,
      reason: "Event bundling must finish before the studio opens.",
    };
  }

  if (snapshot.eb1aClassification?.status !== "completed") {
    return {
      ready: false,
      reason: "EB1A classification must finish before the studio opens.",
    };
  }

  if (snapshot.criteriaTagging?.status !== "completed") {
    return {
      ready: false,
      reason: "Setu finishes preparing the evidence first. The studio opens once tagging completes.",
    };
  }

  if (!snapshot.coverage) {
    return {
      ready: false,
      reason: "Coverage is still being prepared for this workspace.",
    };
  }

  return {
    ready: true,
    reason: null,
  };
}
