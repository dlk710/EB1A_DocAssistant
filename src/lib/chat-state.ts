import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureClientStorage, ensureStorageRoots, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import type {
  ChatArtifactKind,
  ChatArtifactRecord,
  ChatSession,
  ChatTurn,
  StressTestReport,
  StrategyMemo,
} from "@/lib/types";

function ensureDirectory(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function estimateTurnTokens(turn: ChatTurn) {
  const raw = [
    turn.userMessage,
    turn.response.text,
    turn.response.reasoning,
    turn.response.droppedClaims.join(" "),
    turn.response.citations.map((citation) => `${citation.supports} ${citation.excerpt}`).join(" "),
  ]
    .filter(Boolean)
    .join("\n");

  return Math.ceil(raw.length / 4);
}

function trimTurns(turns: ChatTurn[]) {
  const boundedByCount = turns.slice(-50);
  const trimmed: ChatTurn[] = [];
  let runningTokens = 0;

  for (let index = boundedByCount.length - 1; index >= 0; index -= 1) {
    const turn = boundedByCount[index];
    const estimated = estimateTurnTokens(turn);

    if (runningTokens + estimated > 30_000 && trimmed.length > 0) {
      break;
    }

    trimmed.unshift(turn);
    runningTokens += estimated;
  }

  return trimmed;
}

function getSessionDirectory(clientId: string) {
  ensureStorageRoots();
  const directory = path.join(ensureClientStorage(clientId), "chat-sessions");
  ensureDirectory(directory);
  return directory;
}

function artifactDirectoryName(kind: ChatArtifactKind) {
  if (kind === "strategy-memo") {
    return "strategy-memos";
  }

  if (kind === "stress-test-report") {
    return "stress-test-reports";
  }

  return "brief-drafts";
}

function getArtifactDirectory(clientId: string, kind: ChatArtifactKind) {
  ensureStorageRoots();
  const directory = path.join(ensureClientStorage(clientId), artifactDirectoryName(kind));
  ensureDirectory(directory);
  return directory;
}

function getSessionPath(clientId: string, sessionId: string) {
  return path.join(getSessionDirectory(clientId), `${sessionId}.json`);
}

function getArtifactPath(clientId: string, kind: ChatArtifactKind, artifactId: string) {
  return path.join(getArtifactDirectory(clientId, kind), `${artifactId}.json`);
}

function getLatestStrategyMemoPath(clientId: string) {
  return path.join(ensureClientStorage(clientId), "latest-strategy-memo.json");
}

function getLatestStressTestPath(clientId: string) {
  return path.join(ensureClientStorage(clientId), "latest-stress-test-report.json");
}

function normalizeTurn(turn: ChatTurn): ChatTurn {
  return {
    ...turn,
    pendingDocsConsidered: Math.max(0, turn.pendingDocsConsidered ?? 0),
    costUsd: Number.isFinite(turn.costUsd) ? turn.costUsd : 0,
    classification: turn.classification ?? null,
    retrieval: turn.retrieval ?? {
      docIds: [],
      scope: "client",
    },
    response: {
      text: turn.response?.text ?? "",
      artifact: turn.response?.artifact,
      citations: Array.isArray(turn.response?.citations) ? turn.response.citations : [],
      reasoning: turn.response?.reasoning ?? "",
      droppedClaims: Array.isArray(turn.response?.droppedClaims)
        ? turn.response.droppedClaims
        : [],
      pendingDisclosure: turn.response?.pendingDisclosure ?? null,
    },
  };
}

function normalizeSession(session: ChatSession): ChatSession {
  return {
    id: session.id,
    clientId: session.clientId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    mode: session.mode ?? "triage",
    turns: Array.isArray(session.turns) ? trimTurns(session.turns.map(normalizeTurn)) : [],
  };
}

function normalizeArtifact(record: ChatArtifactRecord): ChatArtifactRecord {
  return {
    ...record,
    workspaceIds: Array.isArray(record.workspaceIds) ? record.workspaceIds : [],
    strategyMemo: record.strategyMemo ?? null,
    stressTestReport: record.stressTestReport ?? null,
    briefDraft: record.briefDraft ?? null,
  };
}

function readSessionFile(clientId: string, sessionId: string) {
  return normalizeSession(
    readAbsoluteStateFile<ChatSession>(getSessionPath(clientId, sessionId), {
      id: sessionId,
      clientId,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      mode: "triage",
      turns: [],
    }),
  );
}

export function createChatSession(clientId: string, mode: ChatSession["mode"] = "triage") {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    clientId,
    createdAt: now,
    updatedAt: now,
    mode,
    turns: [],
  };

  saveChatSession(session);
  return session;
}

export function listChatSessions(clientId: string) {
  const directory = getSessionDirectory(clientId);

  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readSessionFile(clientId, entry.replace(/\.json$/, "")))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getChatSession(clientId: string, sessionId: string) {
  return readSessionFile(clientId, sessionId);
}

export function saveChatSession(session: ChatSession) {
  writeAbsoluteStateFile(getSessionPath(session.clientId, session.id), normalizeSession(session));
}

export function appendChatTurn(clientId: string, sessionId: string, turn: ChatTurn, mode: ChatSession["mode"]) {
  const current = getChatSession(clientId, sessionId);
  const nextSession: ChatSession = {
    ...current,
    updatedAt: new Date().toISOString(),
    mode,
    turns: trimTurns([...current.turns, normalizeTurn(turn)]),
  };

  saveChatSession(nextSession);
  return nextSession;
}

export function listChatArtifacts(clientId: string) {
  const kinds: ChatArtifactKind[] = ["strategy-memo", "stress-test-report", "brief-draft"];
  const artifacts = kinds.flatMap((kind) => {
    const directory = getArtifactDirectory(clientId, kind);

    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) =>
        normalizeArtifact(
          readAbsoluteStateFile<ChatArtifactRecord>(
            path.join(directory, entry),
            {
              id: entry.replace(/\.json$/, ""),
              clientId,
              kind,
              createdAt: new Date(0).toISOString(),
              sessionId: "",
              turnId: "",
              version: 1,
              title: "Pinned artifact",
              workspaceIds: [],
            } as ChatArtifactRecord,
          ),
        ),
      );
  });

  return artifacts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function saveChatArtifact(record: ChatArtifactRecord) {
  writeAbsoluteStateFile(
    getArtifactPath(record.clientId, record.kind, record.id),
    normalizeArtifact(record),
  );
}

export function deleteChatArtifact(clientId: string, artifactId: string) {
  const existing = listChatArtifacts(clientId).find((artifact) => artifact.id === artifactId);

  if (!existing) {
    return;
  }

  const filePath = getArtifactPath(clientId, existing.kind, artifactId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function createChatArtifact(input: {
  clientId: string;
  sessionId: string;
  turnId: string;
  kind: ChatArtifactKind;
  title: string;
  workspaceIds: string[];
  strategyMemo?: ChatArtifactRecord["strategyMemo"];
  stressTestReport?: ChatArtifactRecord["stressTestReport"];
  briefDraft?: ChatArtifactRecord["briefDraft"];
}) {
  const existing = listChatArtifacts(input.clientId).filter((artifact) => artifact.kind === input.kind);
  const record: ChatArtifactRecord = {
    id: crypto.randomUUID(),
    clientId: input.clientId,
    kind: input.kind,
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    turnId: input.turnId,
    version: existing.length + 1,
    title: input.title.trim() || "Pinned artifact",
    workspaceIds: input.workspaceIds,
    strategyMemo: input.strategyMemo ?? null,
    stressTestReport: input.stressTestReport ?? null,
    briefDraft: input.briefDraft ?? null,
  };

  saveChatArtifact(record);
  return record;
}

export function getLatestStrategyMemo(clientId: string) {
  return readAbsoluteStateFile<StrategyMemo | null>(getLatestStrategyMemoPath(clientId), null);
}

export function saveLatestStrategyMemo(clientId: string, memo: StrategyMemo) {
  writeAbsoluteStateFile(getLatestStrategyMemoPath(clientId), memo);
}

export function getLatestStressTestReport(clientId: string) {
  return readAbsoluteStateFile<StressTestReport | null>(getLatestStressTestPath(clientId), null);
}

export function saveLatestStressTestReport(clientId: string, report: StressTestReport) {
  writeAbsoluteStateFile(getLatestStressTestPath(clientId), report);
}
