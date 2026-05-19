import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { listJobs, replaceJobs } from "@/lib/jobs";
import {
  ensureClientStorage,
  readAbsoluteStateFile,
  readStateFile,
  writeAbsoluteStateFile,
  writeStateFile,
} from "@/lib/state-store";
import { ensureClientTimelineEvent } from "@/lib/timeline";
import type {
  Client,
  ClientStatus,
  ClientSummary,
  JobRecord,
  PetitionType,
} from "@/lib/types";

interface ClientsRegistryState {
  clients: ClientSummary[];
}

const CLIENTS_REGISTRY_FILE = "clients.json";

function readClientsRegistry() {
  const state = readStateFile<ClientsRegistryState>(CLIENTS_REGISTRY_FILE, {
    clients: [],
  });

  return {
    clients: Array.isArray(state.clients)
      ? [...state.clients]
          .filter((client): client is ClientSummary => Boolean(client?.id))
          .map((client) => ({
            id: client.id,
            displayName: client.displayName ?? "Untitled client",
            petitionType: client.petitionType ?? "EB-1A",
            status: client.status ?? "onboarding",
            updatedAt: client.updatedAt ?? new Date(0).toISOString(),
            lockedStrategyVersion: client.lockedStrategyVersion ?? null,
            lockedAt: client.lockedAt ?? null,
          }))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : [],
  } satisfies ClientsRegistryState;
}

function writeClientsRegistry(state: ClientsRegistryState) {
  writeStateFile(CLIENTS_REGISTRY_FILE, {
    clients: [...state.clients].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  });
}

function getClientFilePath(clientId: string) {
  return path.join(ensureClientStorage(clientId), "client.json");
}

function sanitizeClient(client: Client): Client {
  return {
    id: client.id,
    displayName: client.displayName || "Untitled client",
    petitionType: client.petitionType || "EB-1A",
    status: client.status || "onboarding",
    createdAt: client.createdAt || new Date().toISOString(),
    updatedAt: client.updatedAt || client.createdAt || new Date().toISOString(),
    filingTargetDate: client.filingTargetDate ?? null,
    filedAt: client.filedAt ?? null,
    decidedAt: client.decidedAt ?? null,
    decision: client.decision ?? null,
    notes: client.notes ?? "",
    lockedStrategyVersion: client.lockedStrategyVersion ?? null,
    lockedAt: client.lockedAt ?? null,
  };
}

function readStoredClient(clientId: string) {
  const client = readAbsoluteStateFile<Client | null>(getClientFilePath(clientId), null);
  return client ? sanitizeClient(client) : null;
}

function writeStoredClient(client: Client) {
  writeAbsoluteStateFile(getClientFilePath(client.id), sanitizeClient(client));
}

function toClientSummary(client: Client): ClientSummary {
  return {
    id: client.id,
    displayName: client.displayName,
    petitionType: client.petitionType,
    status: client.status,
    updatedAt: client.updatedAt,
    lockedStrategyVersion: client.lockedStrategyVersion ?? null,
    lockedAt: client.lockedAt ?? null,
  };
}

function saveClientSummary(summary: ClientSummary) {
  const registry = readClientsRegistry();
  const existingIndex = registry.clients.findIndex((client) => client.id === summary.id);

  if (existingIndex === -1) {
    registry.clients.push(summary);
  } else {
    registry.clients[existingIndex] = summary;
  }

  writeClientsRegistry(registry);
}

function createMigratedClientFromJob(job: JobRecord): Client {
  const baseTimestamp = job.createdAt || new Date().toISOString();
  const updatedAt =
    job.completedAt || job.startedAt || job.createdAt || new Date().toISOString();

  return {
    id: job.clientId || crypto.randomUUID(),
    displayName: job.candidateName.trim() || job.folderLabel || "Untitled client",
    petitionType: "EB-1A",
    status:
      job.status === "completed" || job.status === "completed_with_errors"
        ? "reviewing"
        : "onboarding",
    createdAt: baseTimestamp,
    updatedAt,
    filingTargetDate: null,
    filedAt: null,
    decidedAt: null,
    decision: null,
    notes: "",
    lockedStrategyVersion: null,
    lockedAt: null,
  };
}

function ensureClientFromJob(job: JobRecord) {
  const existing = job.clientId ? readStoredClient(job.clientId) : null;
  const client = existing ?? createMigratedClientFromJob(job);

  writeStoredClient(client);
  saveClientSummary(toClientSummary(client));
  ensureClientTimelineEvent({
    id: `${client.id}:client-created`,
    clientId: client.id,
    occurredAt: client.createdAt,
    kind: "client-created",
    workspaceId: null,
    summary: `Client created for ${client.displayName}.`,
    metadata: {
      petitionType: client.petitionType,
      migrated: !existing,
    },
  });
  ensureClientTimelineEvent({
    id: `${job.id}:workspace-added`,
    clientId: client.id,
    occurredAt: job.createdAt,
    kind: "workspace-added",
    workspaceId: job.id,
    summary: `Workspace '${job.folderLabel}' added.`,
    metadata: {
      workspaceId: job.id,
      folderLabel: job.folderLabel,
      candidateName: job.candidateName,
    },
  });

  return client;
}

function normalizeClientStatus(status: ClientStatus) {
  return status;
}

export function ensureClientsHydrated() {
  const jobs = listJobs(500);
  let jobsChanged = false;

  const nextJobs = jobs.map((job) => {
    const client = ensureClientFromJob(job);

    if (job.clientId === client.id) {
      return job;
    }

    jobsChanged = true;
    return {
      ...job,
      clientId: client.id,
    };
  });

  if (jobsChanged) {
    replaceJobs(nextJobs);
  }

  return nextJobs;
}

export function listClients() {
  ensureClientsHydrated();
  return readClientsRegistry().clients;
}

export function getClient(clientId: string) {
  ensureClientsHydrated();
  return readStoredClient(clientId);
}

export function createClient(input: {
  displayName: string;
  petitionType?: PetitionType;
  filingTargetDate?: string | null;
  notes?: string;
}) {
  const now = new Date().toISOString();
  const client: Client = {
    id: crypto.randomUUID(),
    displayName: input.displayName.trim(),
    petitionType: input.petitionType ?? "EB-1A",
    status: "onboarding",
    createdAt: now,
    updatedAt: now,
    filingTargetDate: input.filingTargetDate ?? null,
    filedAt: null,
    decidedAt: null,
    decision: null,
    notes: input.notes?.trim() ?? "",
    lockedStrategyVersion: null,
    lockedAt: null,
  };

  writeStoredClient(client);
  saveClientSummary(toClientSummary(client));
  ensureClientTimelineEvent({
    id: `${client.id}:client-created`,
    clientId: client.id,
    occurredAt: client.createdAt,
    kind: "client-created",
    workspaceId: null,
    summary: `Client created for ${client.displayName}.`,
    metadata: {
      petitionType: client.petitionType,
      migrated: false,
    },
  });

  return client;
}

export function updateClient(
  clientId: string,
  patch: Partial<Omit<Client, "id" | "createdAt">>,
) {
  const current = readStoredClient(clientId);

  if (!current) {
    return null;
  }

  const nextClient = sanitizeClient({
    ...current,
    ...patch,
    status: patch.status ? normalizeClientStatus(patch.status) : current.status,
    updatedAt: new Date().toISOString(),
  });

  writeStoredClient(nextClient);
  saveClientSummary(toClientSummary(nextClient));
  return nextClient;
}

export function getClientStageNumber(status: ClientStatus) {
  switch (status) {
    case "onboarding":
      return 1;
    case "reviewing":
      return 2;
    case "strategizing":
      return 3;
    case "locked":
      return 4;
    case "drafting":
      return 5;
    case "synthesizing":
      return 6;
    case "stitching":
      return 7;
    case "filed":
      return 7;
    case "rfe-response":
    case "decided":
    case "archived":
      return 7;
    default:
      return 1;
  }
}

export function getDraftLifecycleStatus(input: {
  locked: boolean;
  claimedCriteriaCount: number;
  approvedCriteriaCount: number;
}) {
  if (!input.locked) {
    return "strategizing" satisfies ClientStatus;
  }

  if (input.claimedCriteriaCount > 0 && input.approvedCriteriaCount >= input.claimedCriteriaCount) {
    return "synthesizing" satisfies ClientStatus;
  }

  return "drafting" satisfies ClientStatus;
}

export function getSynthesisLifecycleStatus(input: {
  locked: boolean;
  claimedCriteriaCount: number;
  approvedCriteriaCount: number;
  approvedSynthesisCount: number;
}) {
  if (!input.locked) {
    return "strategizing" satisfies ClientStatus;
  }

  if (input.claimedCriteriaCount === 0 || input.approvedCriteriaCount < input.claimedCriteriaCount) {
    return "drafting" satisfies ClientStatus;
  }

  if (input.approvedSynthesisCount >= 2) {
    return "stitching" satisfies ClientStatus;
  }

  return "synthesizing" satisfies ClientStatus;
}

export function listClientJobs(clientId: string) {
  return ensureClientsHydrated().filter((job) => job.clientId === clientId);
}

export function deleteClient(clientId: string) {
  const clientPath = ensureClientStorage(clientId);

  if (fs.existsSync(clientPath)) {
    fs.rmSync(clientPath, { recursive: true, force: true });
  }

  const registry = readClientsRegistry();
  writeClientsRegistry({
    clients: registry.clients.filter((client) => client.id !== clientId),
  });
}
