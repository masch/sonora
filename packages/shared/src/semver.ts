/**
 * Parse a semver string into its numeric parts, stripping pre-release suffixes.
 * Returns null if the string is not a valid semver (major.minor.patch).
 */
function parseSemver(
  v: string,
): { major: number; minor: number; patch: number; preRelease: string } | null {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    preRelease: match[4] ?? '',
  };
}

/**
 * Compare two semver strings: returns `true` if a >= b, `false` if a < b,
 * and `null` if either string is not a valid semver.
 *
 * Pre-release versions compare as lower than their release version
 * (e.g., 1.0.0-alpha < 1.0.0). When both are pre-release, they are
 * compared lexicographically by their pre-release identifier.
 */
export function gte(a: string, b: string): boolean | null {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);

  if (!parsedA || !parsedB) return null;

  // Compare major, minor, patch numerically
  if (parsedA.major !== parsedB.major) return parsedA.major >= parsedB.major;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor >= parsedB.minor;
  if (parsedA.patch !== parsedB.patch) return parsedA.patch >= parsedB.patch;

  // Versions equal numerically — compare pre-release
  // No pre-release means higher than any pre-release
  if (!parsedA.preRelease && !parsedB.preRelease) return true;
  if (!parsedA.preRelease) return true; // release >= pre-release
  if (!parsedB.preRelease) return false; // pre-release < release

  // Both have pre-release — lexicographic compare
  return parsedA.preRelease >= parsedB.preRelease;
}
