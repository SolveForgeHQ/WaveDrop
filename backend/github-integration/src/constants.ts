/**
 * GitHub label names that trigger WaveDrop issue tagging.
 * Maintainers apply these labels to issues to add them to the active wave.
 */
export const WAVE_LABEL_MAP: Record<string, { complexity: "EASY" | "MEDIUM" | "HARD"; points: number }> = {
  "wave:100": { complexity: "EASY",   points: 100 },
  "wave:150": { complexity: "MEDIUM", points: 150 },
  "wave:200": { complexity: "HARD",   points: 200 },
};

export const WAVE_LABEL_NAMES = Object.keys(WAVE_LABEL_MAP);

/** Maximum number of issues a contributor can apply to per wave */
export const MAX_APPLICATIONS_PER_WAVE = 5;

/** The /apply command contributors post in issue comments */
export const APPLY_COMMAND = "/apply";

/** The /assign command maintainers use to assign an applicant */
export const ASSIGN_COMMAND = "/assign";

/** Regex to extract "Closes #N" / "Fixes #N" / "Resolves #N" from PR body */
export const CLOSES_ISSUE_RE = /(?:closes?|fixes?|resolves?)\s+#(\d+)/gi;

/**
 * PRs opened before this ISO date are considered stale and won't earn points.
 * Set to the wave start date in production via env var.
 */
export function getPrCutoffDate(): Date {
  const cutoff = process.env["PR_CUTOFF_DATE"];
  return cutoff ? new Date(cutoff) : new Date("2020-01-01T00:00:00Z");
}
