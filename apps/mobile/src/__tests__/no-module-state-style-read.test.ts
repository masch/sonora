import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The style readiness decision belongs to React state, and S8-R2 says so in code terms:
 * the render decides `loading | ready | error` from state keyed by `url`+`attempt`, and
 * it reads neither the page's document map (`styles`) nor its transfers.
 *
 * Why a source assertion instead of a behavioural one: the device defect was a render
 * and its own effect disagreeing about the same key, which no jest scheduler reproduces
 * (the suite was green while the phone hung, L46). What made it permanent was structural
 * — the render derived the status from a module-scope `Map` React does not track — so the
 * structure is what has to stay pinned. Re-adding a read to the render body, or a
 * presence short-circuit (`styles.has`) to the effect, is exactly the regression this
 * guards, and it used to leave the suite green (L47).
 *
 * The file is read as text for the same reason `config/__tests__/no-baked-map-renderer`
 * reads build profiles: the constraint is about where an expression lives, which no
 * runtime assertion can observe.
 */
const COMPONENT = path.resolve(__dirname, '../components/map/experience-map.tsx');

/**
 * The component's source without comments: these assertions are about what the code
 * reads, and a comment that names `styles.has` is not a read of it.
 */
const source = readFileSync(COMPONENT, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

/** How many times `needle` appears in `haystack`. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** The text from the `from` header up to the `to` header that follows it. */
function region(from: string, to: string): string {
  const start = source.indexOf(from);
  const end = start === -1 ? -1 : source.indexOf(to, start + from.length);
  if (start === -1 || end === -1) {
    throw new Error(`the component no longer declares "${from}" before "${to}"`);
  }
  return source.slice(start, end);
}

/** `useRemoteStyle`, the hook whose render must read no module state. */
const remoteStyle = region('function useRemoteStyle', 'function pendingStageKey');

/** The state initializer half of the hook, and the effect-and-render half after it. */
const [initializer = '', afterInit = ''] = remoteStyle.split('useEffect(');

/** `startStyleTransfer`, the effect-side place a document may be looked up. */
const transferStart = region('function startStyleTransfer', 'function acquireStyleTransfer');

describe('the style decision is React state, not module state (S8-R2)', () => {
  it('checks a component that still declares the code it describes', () => {
    // A guard that passes by reading nothing is worse than no guard: prove the regions
    // hold the code the assertions below are about.
    expect(remoteStyle).toContain('useState<StyleSettlement | null>');
    expect(transferStart).toContain('requestStyleDocument(');
  });

  it('reads the page document map only to prefill the mount, never in the render', () => {
    // One read in the whole hook, and it sits in the `useState` initializer: that is
    // what makes a warm page draw on its first render without a render-time decision.
    expect(count(remoteStyle, 'styles.get(')).toBe(1);
    expect(count(initializer, 'styles.get(')).toBe(1);
    // Everything after the initializer — the effect body and the render that decides
    // the status — reads no document map at all.
    expect(count(afterInit, 'styles.')).toBe(0);
  });

  it('short-circuits on no key presence, so no observation becomes permanent', () => {
    // `styles.has(styleUrl)` used to return early from the effect: a key that existed
    // but could not be drawn was then never fetched again. Presence is not readiness.
    expect(count(source, 'styles.has(')).toBe(0);
  });

  it('looks a document up outside the render only when a transfer starts', () => {
    // The effect asks `acquireStyleTransfer`, which starts a transfer; a transfer that
    // finds the document on the page settles at once instead of fetching it again.
    expect(count(source, 'styles.get(')).toBe(2);
    expect(count(transferStart, 'styles.get(')).toBe(1);
    // And only a transfer writes to it, so what the render prefills is always drawable.
    expect(count(source, 'styles.set(')).toBe(1);
    expect(count(transferStart, 'styles.set(')).toBe(1);
  });
});
