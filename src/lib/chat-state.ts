import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureStorageRoots } from "@/lib/state-store";
import type {
  ChatArtifactKind,
  ChatArtifactRecord,
  ChatSession,
  ChatTurn,
} from "@/lib/types";

const CHAT_SESSIONS_ROOT = path.join(process.cwd(), "storage", "state", "chat-sessions");
const CHAT_ARTIFACTS_ROOT = path.join(process.cwd(), "storage", "state", "chat-artifacts");

function ensureDirectory(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function writeJsonAtomic(filePath: string, value: unknown) {
  ensureDirectory(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  fs.renameSync(tempPath, filePath);
}

function readJsonFile<T>(filePath: string, fallback: T) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return raw.trim() ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getSessionDirectory(jobId: string) {
  ensureStorageRoots();
  return path.join(CHAT_SESSIONS_ROOT, jobId);
}

function getArtifactsDirectory(jobId: string) {
  ensureStorageRoots();
  return path.join(CHAT_ARTIFACTS_ROOT, jobId);
}

function getSessionPath(jobId: string, sessionId: string) {
  return path.join(getSessionDirectory(jobId), `${sessionId}.json`);
}

function getArtifactPath(jobId: string, artifactId: string) {
  return path.join(getArtifactsDirectory(jobId), `${artifactId}.json`);
}

function normalizeTurn(turn: ChatTurn): ChatTurn {
  return {
    ...turn,
    classification: turn.classification ?? null,
    assistantPayload: turn.assistantPayload ?? null,
    usageCostUsd: Number.isFinite(turn.usageCostUsd) ? turn.usageCostUsd : 0,
  };
}

function normalizeSession(session: ChatSession): ChatSession {
  return {
    id: session.id,
    jobId: session.jobId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turns: Array.isArray(session.turns) ? session.turns.map(normalizeTurn) : [],
  };
}

function normalizeArtifact(record: ChatArtifactRecord): ChatArtifactRecord {
  return {
    ...record,
    strategyMemo: record.strategyMemo ?? null,
    stressTestReport: record.stressTestReport ?? null,
    briefDraft: record.briefDraft ?? null,
  };
}

export function createChatSession(jobId: string) {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    jobId,
    createdAt: now,
    updatedAt: now,
    turns: [],
  };

  saveChatSession(session);
  return session;
}

export function listChatSessions(jobId: string) {
  const directory = getSessionDirectory(jobId);
  ensureDirectory(directory);

  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) =>
      normalizeSession(
        readJsonFile<ChatSession>(path.join(directory, entry), {
          id: entry.replace(/\.json$/, ""),
          jobId,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          turns: [],
        }),
      ),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getChatSession(jobId: string, sessionId: string) {
  return normalizeSession(
    readJsonFile<ChatSession>(getSessionPath(jobId, sessionId), {
      id: sessionId,
      jobId,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      turns: [],
    }),
  );
}

export function saveChatSession(session: ChatSession) {
  writeJsonAtomic(getSessionPath(session.jobId, session.id), normalizeSession(session));
}

export function appendChatTurns(jobId: string, sessionId: string, turns: ChatTurn[]) {
  const current = getChatSession(jobId, sessionId);
  const nextSession: ChatSession = {
    ...current,
    updatedAt: new Date().toISOString(),
    turns: [...current.turns, ...turns.map(normalizeTurn)].slice(-50),
  };

  saveChatSession(nextSession);
  return nextSession;
}

export function listChatArtifacts(jobId: string) {
  const directory = getArtifactsDirectory(jobId);
  ensureDirectory(directory);

  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) =>
      normalizeArtifact(
        readJsonFile<ChatArtifactRecord>(path.join(directory, entry), {
          id: entry.replace(/\.json$/, ""),
          jobId,
          kind: "strategy-memo",
          createdAt: new Date(0).toISOString(),
          sessionId: "",
          turnId: "",
          version: 1,
          title: "Pinned artifact",
          strategyMemo: null,
          stressTestReport: null,
          briefDraft: null,
        }),
      ),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function saveChatArtifact(record: ChatArtifactRecord) {
  writeJsonAtomic(getArtifactPath(record.jobId, record.id), normalizeArtifact(record));
}

export function deleteChatArtifact(jobId: string, artifactId: string) {
  const filePath = getArtifactPath(jobId, artifactId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function createChatArtifact(input: {
  jobId: string;
  sessionId: string;
  turnId: string;
  kind: ChatArtifactKind;
  title: string;
  strategyMemo?: ChatArtifactRecord["strategyMemo"];
  stressTestReport?: ChatArtifactRecord["stressTestReport"];
  briefDraft?: ChatArtifactRecord["briefDraft"];
}) {
  const existing = listChatArtifacts(input.jobId).filter((artifact) => artifact.kind === input.kind);
  const record: ChatArtifactRecord = {
    id: crypto.randomUUID(),
    jobId: input.jobId,
    kind: input.kind,
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    turnId: input.turnId,
    version: existing.length + 1,
    title: input.title.trim() || "Pinned artifact",
    strategyMemo: input.strategyMemo ?? null,
    stressTestReport: input.stressTestReport ?? null,
    briefDraft: input.briefDraft ?? null,
  };

  saveChatArtifact(record);
  return record;
}
