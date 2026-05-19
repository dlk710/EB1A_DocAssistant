import type { LibrarySnapshot } from "@/lib/types";

export interface ChatReadiness {
  ready: boolean;
  reason: string | null;
}

export function getChatReadiness(snapshot: LibrarySnapshot): ChatReadiness {
  if (!snapshot.activeClientId || !snapshot.activeClient) {
    return {
      ready: false,
      reason: "Select a client first.",
    };
  }

  if (!snapshot.clientWorkspaces.length) {
    return {
      ready: false,
      reason: "This client does not have any workspaces yet.",
    };
  }

  const incompleteWorkspace = snapshot.clientWorkspaces.find((workspace) => {
    const jobReady =
      workspace.status === "completed" || workspace.status === "completed_with_errors";

    return !jobReady || !workspace.ready;
  });

  if (incompleteWorkspace) {
    return {
      ready: false,
      reason: `Setu finishes preparing every workspace first. '${incompleteWorkspace.folderLabel}' is still not fully ready for strategy chat.`,
    };
  }

  if (!snapshot.clientCoverage) {
    return {
      ready: false,
      reason: "Coverage is still being prepared for this client.",
    };
  }

  return {
    ready: true,
    reason: null,
  };
}
