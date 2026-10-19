import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * The map renderer is decided by the backend (`map.renderer` in the remote config),
 * and the build-time variable only exists so a development build can opt in
 * explicitly. That makes the variable's **absence** from every build profile a
 * requirement, not a preference: `EXPO_PUBLIC_*` values are inlined at build time, so
 * a build that carries this one stops obeying the server forever, silently — and a
 * rollout would look like it never reached the app.
 *
 * Set it on the command line for a one-off build (see the T7 runbook) instead.
 */
const VARIABLE = 'EXPO_PUBLIC_MAP_RENDERER';
const PACKAGE_ROOT = path.resolve(__dirname, '../../..');

/** The files that can bake a value into a build: EAS profiles and env files. */
function bakeableFiles(): string[] {
  const envFiles = readdirSync(PACKAGE_ROOT).filter(
    (name) => name === '.env' || name.startsWith('.env.') || name.startsWith('.env_'),
  );

  return ['eas.json', ...envFiles]
    .map((name) => path.join(PACKAGE_ROOT, name))
    .filter((file) => existsSync(file));
}

describe('the map renderer variable', () => {
  it('has files to check, so the guard cannot pass by looking at nothing', () => {
    expect(bakeableFiles()).toContain(path.join(PACKAGE_ROOT, 'eas.json'));
  });

  it('is baked into no build profile and no env file', () => {
    const offenders = bakeableFiles().filter((file) =>
      readFileSync(file, 'utf8').includes(VARIABLE),
    );

    // If this fails, the build ignores the remote flag: pass the variable on the
    // command line for that one build instead of committing it here.
    expect(offenders).toEqual([]);
  });
});
