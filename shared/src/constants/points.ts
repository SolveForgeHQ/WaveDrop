/**
 * Point tier labels used when tagging GitHub issues.
 * These correspond to the numeric `points` value on an Issue.
 */
export const POINT_TIERS = {
  XS: 1,
  S: 2,
  M: 5,
  L: 10,
  XL: 20,
} as const;

export type PointTier = keyof typeof POINT_TIERS;

/** GitHub label prefix used to identify bounty issues, e.g. "wavedrop:M" */
export const GITHUB_LABEL_PREFIX = "wavedrop:" as const;
