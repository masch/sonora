import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { SUPPORTED_LANGUAGES } from '@sonora/shared';

import {
  LOCATION_USAGE_INFO_PLIST_KEY,
  buildInfoPlistStrings,
  writeInfoPlistStringsFile,
} from '../../plugins/with-localized-location-permission.ts';
import { LOCATION_USAGE_COPY } from '../i18n/location-permission-copy.ts';

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

describe('LOCATION_USAGE_COPY', () => {
  it('carries one sentence for every language the app declares', () => {
    expect(Object.keys(LOCATION_USAGE_COPY).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
});

describe('app.config.ts', () => {
  const appConfig = readFileSync(path.resolve(__dirname, '../../app.config.ts'), 'utf8');

  it('registers the localized permission plugin', () => {
    expect(appConfig).toContain('with-localized-location-permission');
  });

  it('reads the location copy from the i18n resources instead of restating it', () => {
    expect(appConfig).toContain('LOCATION_USAGE_COPY');

    for (const language of SUPPORTED_LANGUAGES) {
      expect(appConfig).not.toContain(LOCATION_USAGE_COPY[language]);
    }
  });
});
