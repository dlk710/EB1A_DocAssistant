import type { EvidenceGridBundleOption, EvidenceGridDocument } from "@/lib/evidence-query";

export type SaveState = "saved" | "unsaved" | "saving";

export interface EvidenceGridFilters {
  workspaceId: string;
  bundleId: string;
  criterionCode: string;
  disposition: string;
  objectiveEvidence: "" | "objective" | "subjective" | "mixed";
  aiUnsure: boolean;
  showAutoTagged: boolean;
  showFirstCutArchive: boolean;
  search: string;
}

export type GridMutation =
  | {
      kind: "tag";
      documentId: string;
      criterionCode: string;
      state: "suggested" | "enabled" | "disabled";
      role?: "primary" | "supporting";
    }
  | {
      kind: "disposition";
      documentId: string;
      disposition: "untouched" | "tagged" | "reference" | "archived";
    }
  | {
      kind: "bulk-tag";
      documentIds: string[];
      criterionCode: string;
      state: "suggested" | "enabled" | "disabled";
      role?: "primary" | "supporting";
    }
  | {
      kind: "bulk-disposition";
      documentIds: string[];
      disposition: "untouched" | "tagged" | "reference" | "archived";
    }
  | {
      kind: "bulk-move";
      jobId: string;
      documentIds: string[];
      targetBundleId: string;
    };

export interface QuickPeekPayload {
  ok: true;
  documentId: string;
  summary: EvidenceGridDocument["summary"];
  tags: EvidenceGridDocument["criteriaTags"];
  tagLabels: string[];
  previewText: string;
  metadata: {
    pageCount: number | null;
    indexedAt: string;
    bundleHint: string | null;
    sourceKind: string;
    workspaceLabel: string;
    relativePath: string;
  };
}

export interface EvidenceGridProps {
  clientId: string;
  clientName: string;
  initialDocuments: EvidenceGridDocument[];
  bundleOptions: EvidenceGridBundleOption[];
  workspaceOptions: Array<{ id: string; name: string }>;
}
