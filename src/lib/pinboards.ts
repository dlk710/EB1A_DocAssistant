import path from "node:path";
import { ensureClientStorage, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import type { CriterionPinboard, PinboardEntry } from "@/lib/types";

function getPinboardsDirectory(clientId: string) {
  return path.join(ensureClientStorage(clientId), "pinboards");
}

function getPinboardPath(clientId: string, criterionCode: string) {
  return path.join(getPinboardsDirectory(clientId), `${criterionCode}.json`);
}

export function getCriterionPinboard(clientId: string, criterionCode: string) {
  return readAbsoluteStateFile<CriterionPinboard | null>(
    getPinboardPath(clientId, criterionCode),
    null,
  );
}

export function saveCriterionPinboard(pinboard: CriterionPinboard) {
  writeAbsoluteStateFile(
    getPinboardPath(pinboard.clientId, pinboard.criterionCode),
    pinboard,
  );
}

export function upsertCriterionPinboard(input: {
  clientId: string;
  criterionCode: string;
  entries: PinboardEntry[];
}) {
  const existing = getCriterionPinboard(input.clientId, input.criterionCode);
  const now = new Date().toISOString();
  const pinboard: CriterionPinboard = {
    clientId: input.clientId,
    criterionCode: input.criterionCode,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    entries: input.entries,
  };

  saveCriterionPinboard(pinboard);
  return pinboard;
}
