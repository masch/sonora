import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SUPPORTED_LANGUAGES } from '@sonora/shared';

import {
  LOCATION_USAGE_INFO_PLIST_KEY,
  buildInfoPlistStrings,
  planInfoPlistStringsLink,
  writeInfoPlistStringsFile,
} from '../../plugins/with-localized-location-permission.ts';
import { LOCATION_USAGE_COPY, LOCATION_USAGE_FALLBACK } from '../i18n/location-permission-copy.ts';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

/** The fields of the resolved config these tests assert on. */
interface ResolvedExpoConfig {
  plugins?: (string | [string, unknown])[];
  ios?: { infoPlist?: Record<string, unknown> };
}

/**
 * Evaluate the app config the way `expo config` does and return the resolved `exp`.
 *
 * It runs as a child process on purpose: jest replaces `process.env` with a sandboxed
 * copy, while `app.config.ts` is evaluated by Node's own loader, outside that sandbox.
 * The version the config refuses to start without therefore has to be handed to a real
 * process, the same way CI does it.
 */
function evaluateAppConfig(): ResolvedExpoConfig {
  const output = execFileSync(
    process.execPath,
    [require.resolve('expo/bin/cli'), 'config', '--json', '--full'],
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env, APP_VERSION_NAME: process.env.APP_VERSION_NAME || '1.0.0' },
      encoding: 'utf8',
    },
  );

  return (JSON.parse(output) as { exp: ResolvedExpoConfig }).exp;
}

describe('buildInfoPlistStrings', () => {
  it('writes the location usage description of the requested language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(buildInfoPlistStrings(language, LOCATION_USAGE_COPY)).toBe(
        `${LOCATION_USAGE_INFO_PLIST_KEY} = "${LOCATION_USAGE_COPY[language]}";\n`,
      );
    }
  });

  it('escapes quotes and backslashes so the strings file stays parseable', () => {
    expect(buildInfoPlistStrings('es', { es: 'Di "sí" a C:\\ruta' })).toBe(
      `${LOCATION_USAGE_INFO_PLIST_KEY} = "Di \\"sí\\" a C:\\\\ruta";\n`,
    );
  });

  it('refuses a language with no declared copy', () => {
    expect(() => buildInfoPlistStrings('pt', LOCATION_USAGE_COPY)).toThrow(
      `No ${LOCATION_USAGE_INFO_PLIST_KEY} copy is declared for language "pt"`,
    );
  });
});

describe('writeInfoPlistStringsFile', () => {
  let supportingDirectory: string;

  beforeEach(async () => {
    supportingDirectory = await mkdtemp(path.join(tmpdir(), 'sonora-info-plist-'));
  });

  afterEach(async () => {
    await rm(supportingDirectory, { recursive: true, force: true });
  });

  it('writes each language under its own .lproj folder', async () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const stringsFile = await writeInfoPlistStringsFile(
        supportingDirectory,
        language,
        LOCATION_USAGE_COPY,
      );

      expect(path.relative(supportingDirectory, stringsFile)).toBe(
        `${language}.lproj/InfoPlist.strings`,
      );
      expect(readFileSync(stringsFile, 'utf8')).toBe(
        buildInfoPlistStrings(language, LOCATION_USAGE_COPY),
      );
    }
  });

  it('leaves no lproj folder behind for a language with no copy', async () => {
    await expect(
      writeInfoPlistStringsFile(supportingDirectory, 'pt', LOCATION_USAGE_COPY),
    ).rejects.toThrow(`No ${LOCATION_USAGE_INFO_PLIST_KEY} copy is declared for language "pt"`);

    expect(existsSync(path.join(supportingDirectory, 'pt.lproj'))).toBe(false);
  });
});

describe('planInfoPlistStringsLink', () => {
  it('references the language directory when the group carries no path of its own', () => {
    const expected = { referencePath: 'es.lproj/InfoPlist.strings', alreadyLinked: false };

    expect(planInfoPlistStringsLink({ language: 'es' })).toEqual(expected);
    // What Expo's own group helper records for a group it creates.
    expect(planInfoPlistStringsLink({ language: 'es', groupPath: '""' })).toEqual(expected);
  });

  it('drops the duplicated language directory when the group already sits in it', () => {
    for (const groupPath of ['es.lproj', '"es.lproj"', 'Supporting/es.lproj', './es.lproj/']) {
      expect(planInfoPlistStringsLink({ language: 'es', groupPath })).toEqual({
        referencePath: 'InfoPlist.strings',
        alreadyLinked: false,
      });
    }
  });

  it('keeps the language directory when the group sits somewhere else', () => {
    for (const groupPath of ['Supporting', 'en.lproj', 'Supporting/en.lproj']) {
      expect(planInfoPlistStringsLink({ language: 'es', groupPath }).referencePath).toBe(
        'es.lproj/InfoPlist.strings',
      );
    }
  });

  it('does not link a file the project already references', () => {
    for (const reference of [
      'es.lproj/InfoPlist.strings',
      'Sonora/Supporting/es.lproj/InfoPlist.strings',
      './es.lproj/InfoPlist.strings',
      'es.lproj\\InfoPlist.strings',
    ]) {
      expect(planInfoPlistStringsLink({ language: 'es', projectReferences: [reference] })).toEqual({
        referencePath: 'es.lproj/InfoPlist.strings',
        alreadyLinked: true,
      });
    }
  });

  it('does not link twice when the language group already holds the file', () => {
    expect(
      planInfoPlistStringsLink({
        language: 'es',
        groupPath: 'es.lproj',
        groupReferences: ['InfoPlist.strings'],
      }).alreadyLinked,
    ).toBe(true);

    expect(
      planInfoPlistStringsLink({
        language: 'es',
        groupPath: '',
        groupReferences: ['es.lproj/InfoPlist.strings'],
      }).alreadyLinked,
    ).toBe(true);
  });

  it('still links a language the project holds no reference for', () => {
    expect(
      planInfoPlistStringsLink({
        language: 'es',
        groupPath: 'es.lproj',
        groupReferences: [],
        projectReferences: ['en.lproj/InfoPlist.strings'],
      }).alreadyLinked,
    ).toBe(false);
  });
});

describe('LOCATION_USAGE_COPY', () => {
  it('carries one sentence for every language the app declares', () => {
    expect(Object.keys(LOCATION_USAGE_COPY).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
});

/**
 * The resolved config, not the text of `app.config.ts`: a string assertion stays green
 * when the registration it names is deleted, so it proves nothing about the app.
 */
describe('app.config', () => {
  let exp: ResolvedExpoConfig;

  beforeAll(() => {
    exp = evaluateAppConfig();
  }, 60_000);

  /** The `[name, props]` entry a plugin was registered with, or undefined. */
  function pluginEntry(name: string): [string, unknown] | undefined {
    return (exp.plugins ?? []).find(
      (plugin): plugin is [string, unknown] => Array.isArray(plugin) && plugin[0] === name,
    );
  }

  it('registers the localized permission plugin with the copy from the i18n resources', () => {
    const entry = pluginEntry('./plugins/with-localized-location-permission');

    expect(entry).toBeDefined();
    expect(entry?.[1]).toEqual({ messages: LOCATION_USAGE_COPY });
  });

  it('asks for the location only while in use, with the i18n fallback', () => {
    const entry = pluginEntry('expo-location');

    expect(entry?.[1]).toMatchObject({
      locationWhenInUsePermission: LOCATION_USAGE_FALLBACK,
      locationAlwaysAndWhenInUsePermission: false,
      locationAlwaysPermission: false,
      motionUsagePermission: false,
    });
  });

  it('allows mixed localizations so InfoPlist.strings follows the device language', () => {
    expect(exp.ios?.infoPlist?.CFBundleAllowMixedLocalizations).toBe(true);
  });
});
