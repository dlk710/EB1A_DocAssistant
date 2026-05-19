import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { STORAGE_ROOT } from "@/lib/constants";
import { setActiveStyleProfileId } from "@/lib/settings";
import { ensureStateSubdirectory, readAbsoluteStateFile, writeAbsoluteStateFile } from "@/lib/state-store";
import type { StyleExemplar, StyleProfile } from "@/lib/types";

const STYLE_PROFILE_STATE_DIR = ["style-profiles"];
const DEFAULT_PROFILE_PATH = path.join(STORAGE_ROOT, "style-profiles", "default.json");

const RELATED_CRITERIA: Record<string, string[]> = {
  "01": ["03", "04", "06"],
  "03": ["06", "01", "11"],
  "04": ["01", "06", "08"],
  "05": ["08", "11", "09"],
  "06": ["03", "01", "11"],
  "08": ["05", "11", "09"],
  "09": ["08", "05", "11"],
  "11": ["08", "05", "06"],
};

const DEFAULT_STYLE_PROFILE: StyleProfile = {
  id: "default",
  attorneyId: "default",
  displayName: "Setu default",
  isDefault: true,
  createdAt: "2026-05-18T00:00:00.000Z",
  updatedAt: "2026-05-18T00:00:00.000Z",
  exemplars: [
    {
      id: "default-v",
      label: "Original contributions reference",
      criterionCode: "05",
      approvedOutcome: true,
      notes: "Declarative criterion-(v) style reference.",
      text:
        "The record shows that the petitioner did more than participate in product delivery; he originated technical work that the employer later relied upon at scale. The evidence does not ask the adjudicator to infer originality from title alone. Instead, it traces the petitioner’s role from the design decision to the business outcome. The technical letters explain that he defined the ranking and retrieval approach used by the platform, established the model behavior that governed production output, and solved failure modes that had blocked deployment. Internal architecture records and corroborating correspondence then show that those design choices moved from proposal to operating system. The result is a record in which the contribution is identifiable, attributable, and consequential. Where the evidence discusses impact, it does so concretely. It ties the petitioner’s work to production adoption, measurable usage, and downstream dependence by other teams. That is the kind of significance the criterion contemplates: not praise in the abstract, but a contribution other professionals relied on because it materially improved how the organization performed an important function.",
    },
    {
      id: "default-viii",
      label: "Leading or critical role reference",
      criterionCode: "08",
      approvedOutcome: true,
      notes: "Declarative criterion-(viii) style reference.",
      text:
        "The evidence supports a conclusion that the petitioner served in a leading or critical role for organizations with distinguished reputations. The record identifies the relevant business function first and then places the petitioner inside it. Rather than resting on a managerial title, the record shows responsibility over a core platform, dependence by senior stakeholders, and decisions that affected production delivery. Letters from supervisors and business partners describe why the role was important to the enterprise and why the petitioner, specifically, was entrusted with it. Supporting materials then anchor those descriptions in objective context, including platform usage, scope of deployment, and the commercial importance of the systems at issue. This structure matters. It demonstrates not merely that the petitioner worked on significant projects, but that he occupied a role whose successful performance was important to the employer’s operations. The distinction between participation and criticality is therefore made with evidence, not adjectives.",
    },
    {
      id: "default-iv",
      label: "Judging reference",
      criterionCode: "04",
      approvedOutcome: true,
      notes: "Declarative criterion-(iv) style reference.",
      text:
        "The judging criterion is satisfied where the record shows that the petitioner was asked to evaluate the work of others in the field. Here, the evidence does that directly. The invitation and appointment materials identify the reviewing body, the year of service, and the petitioner’s role as a judge or evaluator. The corroborating materials show that the selection was not casual or internal-only, but tied to a professional program that depended on subject-matter judgment. The significance of the evidence lies in what the invitation represents: third parties sought the petitioner’s expertise to assess the merit of others’ work. The record therefore establishes the key point in straightforward terms. It is not necessary to embellish the service. The fact that a recognized organization entrusted the petitioner with evaluative responsibility is itself the relevant proof under the criterion.",
    },
    {
      id: "default-vi",
      label: "Authorship reference",
      criterionCode: "06",
      approvedOutcome: true,
      notes: "Declarative criterion-(vi) style reference.",
      text:
        "The authorship evidence shows that the petitioner has produced written technical material for a professional audience. The record identifies the publication, connects the petitioner to the authorship, and supplies enough context for the adjudicator to understand why the article mattered. This is important because the criterion concerns authored contributions, not generic references to writing. The petitioner’s article is described with specificity: the subject matter, the publication venue, and the connection between the written work and the petitioner’s field. Where available, the record also shows how the article circulated or why practitioners would consult it. The resulting argument remains disciplined. It does not overstate readership or influence where the evidence does not quantify those points. Instead, it demonstrates authorship through attribution and professional context, which is the evidentiary core of the criterion.",
    },
    {
      id: "default-i",
      label: "Awards reference",
      criterionCode: "01",
      approvedOutcome: true,
      notes: "Declarative criterion-(i) style reference.",
      text:
        "The awards evidence is strongest when it explains both what the petitioner received and why the recognition matters. The record here follows that path. It identifies the honor, the awarding body, and the event or program through which the recognition was given. It then situates the award within the petitioner’s field by describing the organization conferring it and the accomplishment being recognized. This prevents the argument from collapsing into a bare certificate. The adjudicator is shown not only that an award exists, but that it reflects professional recognition for the petitioner’s work. The prose should therefore stay measured. It should describe the recognition, its source, and the connection to the petitioner’s field, allowing the supporting exhibits to establish the rest.",
    },
  ],
};

function ensureDirectory(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function getProfileStateDirectory() {
  return ensureStateSubdirectory(...STYLE_PROFILE_STATE_DIR);
}

function getProfilePath(id: string) {
  return path.join(getProfileStateDirectory(), `${id}.json`);
}

function writeDefaultProfileIfMissing() {
  ensureDirectory(path.dirname(DEFAULT_PROFILE_PATH));
  if (!fs.existsSync(DEFAULT_PROFILE_PATH)) {
    fs.writeFileSync(DEFAULT_PROFILE_PATH, JSON.stringify(DEFAULT_STYLE_PROFILE, null, 2));
  }
}

function normalizeProfile(profile: StyleProfile): StyleProfile {
  return {
    id: profile.id,
    attorneyId: profile.attorneyId || "default",
    displayName: profile.displayName || "Untitled profile",
    exemplars: Array.isArray(profile.exemplars) ? profile.exemplars : [],
    isDefault: Boolean(profile.isDefault),
    createdAt: profile.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || profile.createdAt || new Date().toISOString(),
  };
}

export function getDefaultStyleProfile() {
  writeDefaultProfileIfMissing();
  return normalizeProfile(readAbsoluteStateFile<StyleProfile>(DEFAULT_PROFILE_PATH, DEFAULT_STYLE_PROFILE));
}

export function listStyleProfiles() {
  const directory = getProfileStateDirectory();
  const userProfiles = fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) =>
      normalizeProfile(
        readAbsoluteStateFile<StyleProfile>(
          path.join(directory, entry),
          {
            ...DEFAULT_STYLE_PROFILE,
            id: entry.replace(/\.json$/, ""),
            isDefault: false,
          },
        ),
      ),
    )
    .filter((profile) => !profile.isDefault && profile.id !== "default");

  return [getDefaultStyleProfile(), ...userProfiles].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

export function getStyleProfile(id: string) {
  if (id === "default") {
    return getDefaultStyleProfile();
  }
  const profilePath = getProfilePath(id);
  if (!fs.existsSync(profilePath)) {
    return null;
  }
  return normalizeProfile(readAbsoluteStateFile<StyleProfile>(profilePath, DEFAULT_STYLE_PROFILE));
}

export function createStyleProfile(input: { displayName: string }) {
  const now = new Date().toISOString();
  const profile: StyleProfile = {
    id: crypto.randomUUID(),
    attorneyId: "default",
    displayName: input.displayName.trim() || "Untitled profile",
    exemplars: [],
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  writeAbsoluteStateFile(getProfilePath(profile.id), profile);
  return profile;
}

export function updateStyleProfile(id: string, patch: Partial<Pick<StyleProfile, "displayName">>) {
  const current = getStyleProfile(id);
  if (!current || current.isDefault) {
    return current;
  }
  const next = normalizeProfile({
    ...current,
    displayName: patch.displayName?.trim() || current.displayName,
    updatedAt: new Date().toISOString(),
  });
  writeAbsoluteStateFile(getProfilePath(id), next);
  return next;
}

export function deleteStyleProfile(id: string) {
  if (id === "default") {
    return false;
  }
  const profilePath = getProfilePath(id);
  if (fs.existsSync(profilePath)) {
    fs.unlinkSync(profilePath);
  }
  return true;
}

export function addStyleExemplar(
  profileId: string,
  input: Omit<StyleExemplar, "id">,
) {
  const current = getStyleProfile(profileId);
  if (!current || current.isDefault) {
    return null;
  }
  const exemplar: StyleExemplar = {
    ...input,
    id: crypto.randomUUID(),
  };
  const next = normalizeProfile({
    ...current,
    exemplars: [...current.exemplars, exemplar],
    updatedAt: new Date().toISOString(),
  });
  writeAbsoluteStateFile(getProfilePath(profileId), next);
  return exemplar;
}

export function updateStyleExemplar(
  profileId: string,
  exemplarId: string,
  patch: Partial<Omit<StyleExemplar, "id">>,
) {
  const current = getStyleProfile(profileId);
  if (!current || current.isDefault) {
    return null;
  }
  const next = normalizeProfile({
    ...current,
    exemplars: current.exemplars.map((exemplar) =>
      exemplar.id === exemplarId
        ? {
            ...exemplar,
            ...patch,
            label: patch.label?.trim() || exemplar.label,
            criterionCode: patch.criterionCode?.trim() || exemplar.criterionCode,
            text: patch.text?.trim() || exemplar.text,
            notes: patch.notes?.trim() || exemplar.notes,
            approvedOutcome:
              typeof patch.approvedOutcome === "boolean"
                ? patch.approvedOutcome
                : exemplar.approvedOutcome,
          }
        : exemplar,
    ),
    updatedAt: new Date().toISOString(),
  });
  writeAbsoluteStateFile(getProfilePath(profileId), next);
  return next.exemplars.find((exemplar) => exemplar.id === exemplarId) ?? null;
}

export function deleteStyleExemplar(profileId: string, exemplarId: string) {
  const current = getStyleProfile(profileId);
  if (!current || current.isDefault) {
    return null;
  }
  const next = normalizeProfile({
    ...current,
    exemplars: current.exemplars.filter((exemplar) => exemplar.id !== exemplarId),
    updatedAt: new Date().toISOString(),
  });
  writeAbsoluteStateFile(getProfilePath(profileId), next);
  return next;
}

export function setActiveStyleProfile(profileId: string) {
  setActiveStyleProfileId(profileId);
  return getStyleProfile(profileId);
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return text.trim();
  }
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function selectStyleExemplars(profileId: string, criterionCode: string) {
  const profile = getStyleProfile(profileId) || getDefaultStyleProfile();
  const direct = profile.exemplars.filter((exemplar) => exemplar.criterionCode === criterionCode);
  const fallbackCodes = RELATED_CRITERIA[criterionCode] ?? [];
  const fallback = profile.exemplars.filter(
    (exemplar) => !direct.some((entry) => entry.id === exemplar.id) && fallbackCodes.includes(exemplar.criterionCode),
  );
  const selected = [...direct, ...fallback]
    .sort((left, right) => right.text.length - left.text.length)
    .slice(0, 3)
    .map((exemplar) => ({
      ...exemplar,
      text: truncateWords(exemplar.text, 500),
    }));

  return {
    profile,
    exemplars: selected.length ? selected : profile.exemplars.slice(0, 2).map((exemplar) => ({
      ...exemplar,
      text: truncateWords(exemplar.text, 500),
    })),
  };
}
