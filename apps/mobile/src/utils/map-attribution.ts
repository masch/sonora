/**
 * The map's attribution notice, with the version of the artifact the device draws.
 *
 * The notice itself is not ours. It is written by the style document the map draws
 * (`sources.basemap.attribution`), and MapLibre shows it verbatim; the owner asked that
 * the same notice also say which version of the map is loaded, so the walker can tell a
 * fresh download from a stale one without opening a sheet (`© OpenStreetMap contributors
 * (v7)`).
 *
 * So this module only appends, and only the suffix: the base text stays exactly as the
 * style wrote it, the suffix is ` (v7)` inside the same notice rather than a second line
 * or a translation of the legal text, and nothing is fabricated when either half of the
 * statement is missing. Both renderers call this — the web instance where it builds the
 * style, the native one where it builds the style handed to MapLibre — because two
 * implementations of one notice is how the two platforms end up disagreeing about it.
 */

/**
 * A version already written into the notice: `(v7)`, or the bare `(7)` a style that
 * writes its own version may have used.
 *
 * The test is on the end of the notice because the suffix is what this module writes:
 * one already there is this app's own convention, satisfied.
 */
const NAMED_VERSION = /\((?:v\d[^()]*|\d[^()]*)\)$/i;

/**
 * The notice with ` (v7)` appended, or the notice unchanged when there is no version to
 * name or nothing to append it to.
 *
 * `undefined` means "this map publishes no attribution": the caller must then leave the
 * style's source alone instead of writing an empty credit. A version the archive could
 * not be keyed by (`null`, the resolved answer for a url this app does not understand)
 * is not a version: the notice is returned exactly as the style wrote it, never with a
 * `(v?)` or a `(v0)` standing in for an answer nobody has.
 *
 * The append is plain concatenation on purpose. The base string carries markup — the
 * OpenStreetMap credit is a link — so the suffix has to land after the closing tag, as
 * text, where HTML will show it and the anchor will not swallow it.
 */
export function attributionWithVersion(
  attribution: string | null | undefined,
  archiveVersion: string | null | undefined,
): string | undefined {
  if (typeof attribution !== 'string' || attribution.trim().length === 0) return undefined;

  const version = archiveVersion?.trim();
  if (!version) return attribution;

  // One version in the notice is the whole statement: appending the same one again reads
  // as two maps, and rewriting the one the style authored would edit a notice this app
  // only ever extends.
  const notice = attribution.trimEnd();
  if (NAMED_VERSION.test(notice)) return attribution;

  return `${notice} (${version})`;
}
