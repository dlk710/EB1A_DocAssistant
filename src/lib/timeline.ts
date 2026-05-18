import path from "node:path";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import type { ClientTimelineEvent } from "@/lib/types";

function getTimelineFilePath(clientId: string) {
  return path.join(ensureClientStorage(clientId), "timeline.json");
}

function sortTimeline(events: ClientTimelineEvent[]) {
  return [...events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function listClientTimeline(clientId: string) {
  return sortTimeline(
    readAbsoluteStateFile<ClientTimelineEvent[]>(getTimelineFilePath(clientId), []),
  );
}

export function saveClientTimeline(clientId: string, events: ClientTimelineEvent[]) {
  writeAbsoluteStateFile(getTimelineFilePath(clientId), sortTimeline(events));
}

export function appendClientTimelineEvent(event: ClientTimelineEvent) {
  const current = listClientTimeline(event.clientId);
  saveClientTimeline(event.clientId, [event, ...current]);
  return event;
}

export function ensureClientTimelineEvent(event: ClientTimelineEvent) {
  const current = listClientTimeline(event.clientId);

  if (current.some((entry) => entry.id === event.id)) {
    return current.find((entry) => entry.id === event.id) ?? event;
  }

  saveClientTimeline(event.clientId, [event, ...current]);
  return event;
}

export function removeClientTimeline(clientId: string) {
  saveClientTimeline(clientId, []);
}
