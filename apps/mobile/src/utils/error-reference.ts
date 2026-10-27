/**
 * Error references (`E-XXXXXX`) derived deterministically from an error.
 *
 * The code is deliberately derived, never random: it is a *grouping key* for us
 * — every occurrence of the same failure folds into one bucket we can count and
 * search for in Crashlytics/Firebase — and a *sentence* for the walker, who
 * reads the code off a crashing screen and says "it says E-ABC123".
 *
 * What it identifies is the **message**, not the occurrence and not the place:
 * stacks differ between iOS, Android and web, and their line numbers change with
 * every build, so hashing one would split a single failure into a code per
 * platform and per release. The message is the only part that survives those
 * differences; the route and the raw message travel next to the reference, which
 * is where the localisation comes from.
 */

/** Six base-36 characters keep the code short enough to read aloud over a phone call. */
const CODE_LENGTH = 6;
const CODE_SPACE = 36 ** CODE_LENGTH;

/** djb2-style rolling hash, folded into the unsigned 32-bit range at every step. */
function hash(input: string): number {
  let accumulated = 5381;
  for (let index = 0; index < input.length; index++) {
    accumulated = ((accumulated * 33) ^ input.charCodeAt(index)) >>> 0;
  }
  return accumulated;
}

/**
 * Returns the stable reference for any thrown value: `E-` plus six uppercase
 * base-36 characters hashed from the message.
 *
 * The stack is deliberately left out: it is what differs across platforms and
 * builds, so including it would give the same failure a new code per release.
 */
export function errorReference(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  const code = (hash(message) % CODE_SPACE).toString(36).toUpperCase().padStart(CODE_LENGTH, '0');

  return `E-${code}`;
}
