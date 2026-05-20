export function hasApprovedVersion<
  T extends { latestApprovedVersion?: number | null | undefined } | null | undefined,
>(
  entry: T,
): entry is Exclude<T, null | undefined> {
  return typeof entry?.latestApprovedVersion === "number";
}

export function countApproved<
  T extends { latestApprovedVersion?: number | null | undefined } | null | undefined,
>(
  entries: readonly T[],
) {
  return entries.filter(hasApprovedVersion).length;
}
