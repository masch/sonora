import { errorReference } from '../utils/error-reference';

/** Builds an error with a fixed stack so the derivation is platform independent in the test. */
function makeError(message: string, stack: string): Error {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

describe('errorReference', () => {
  it('returns the same code for the same error', () => {
    const stack = 'Error: boom\n    at first (src/a.ts:1:1)';

    expect(errorReference(makeError('boom', stack))).toBe(errorReference(makeError('boom', stack)));
  });

  it('returns the same code for the same message whatever the stack says', () => {
    const firstError = makeError('boom', 'Error: boom\n    at first (src/a.ts:1:1)');
    const secondError = makeError('boom', 'Error: boom\n    at second (src/b.ts:9:9)');

    // Stacks differ between iOS, Android and web, and their line numbers move with
    // every build: hashing one would split a single failure into a code per
    // platform and per release, which is the opposite of a grouping key.
    expect(errorReference(firstError)).toBe(errorReference(secondError));
  });

  it('returns a different code when the message differs', () => {
    const stack = 'Error: boom\n    at first (src/a.ts:1:1)';

    expect(errorReference(makeError('boom', stack))).not.toBe(
      errorReference(makeError('bang', stack)),
    );
  });

  it('returns an E-prefixed six character base-36 code', () => {
    expect(
      errorReference(makeError('anything', 'Error: anything\n    at x (src/x.ts:2:2)')),
    ).toMatch(/^E-[0-9A-Z]{6}$/);
  });
});
