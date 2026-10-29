/**
 * The pinned toolchain a tile build needs, and the tests that keep it honest.
 *
 * No test touches the network: the download and the extraction are injected, and the digests
 * are computed here from bytes this file owns.
 */
import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Command } from '../build';
import type { DownloadOptions, DownloadResult } from '../download';
import {
  TOOLCHAIN,
  type ToolchainArtefact,
  checksumProblem,
  installToolchain,
  toolchainRoot,
  toolchainEnv,
} from '../toolchain';

function scratch(): string {
  return mkdtempSync(join(tmpdir(), 'map-tiles-toolchain-'));
}

const JDK: ToolchainArtefact = {
  name: 'jdk',
  version: '21.0.test',
  url: 'https://example.invalid/jdk.tar.gz',
  bytes: 10,
  digest: { algorithm: 'sha256', value: '' },
};

const MAVEN: ToolchainArtefact = {
  name: 'maven',
  version: '3.9.test',
  url: 'https://example.invalid/maven.tar.gz',
  bytes: 4,
  digest: { algorithm: 'sha512', value: '' },
};

function digestOf(algorithm: 'sha256' | 'sha512', text: string): string {
  return createHash(algorithm).update(text).digest('hex');
}

/** The two artefacts with digests of the bytes these tests will "download". */
function artefacts(): ToolchainArtefact[] {
  return [
    { ...JDK, digest: { algorithm: 'sha256', value: digestOf('sha256', 'jdk-bytes') } },
    { ...MAVEN, digest: { algorithm: 'sha512', value: digestOf('sha512', 'mv') } },
  ];
}

describe('checksumProblem', () => {
  it('accepts the file whose digest the project published', () => {
    const root = scratch();
    try {
      const path = join(root, 'archive.tar.gz');
      writeFileSync(path, 'jdk-bytes');
      expect(checksumProblem(path, 'sha256', digestOf('sha256', 'jdk-bytes'))).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('names the mismatch, so a wrong or truncated download is never extracted', () => {
    const root = scratch();
    try {
      const path = join(root, 'archive.tar.gz');
      writeFileSync(path, 'jdk-bytes');
      const problem = checksumProblem(path, 'sha256', digestOf('sha256', 'something-else'));
      expect(problem).toContain('sha256');
      expect(problem).toContain(path);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('installToolchain', () => {
  /** A download that writes the bytes the digest expects, and records what it was asked. */
  function downloader(seen: DownloadOptions[]) {
    return async (options: DownloadOptions): Promise<DownloadResult> => {
      seen.push(options);
      const body = options.url.includes('jdk') ? 'jdk-bytes' : 'mv';
      writeFileSync(options.destination, body);
      return { ok: true, bytes: body.length, resumedFrom: 0, attempts: 1, cached: false };
    };
  }

  it('installs both artefacts, unpacks them flat and reports the environment', async () => {
    const root = scratch();
    try {
      const downloads: DownloadOptions[] = [];
      const commands: Command[] = [];
      const result = await installToolchain(
        { root, artefacts: artefacts() },
        {
          download: downloader(downloads),
          run: async (command) => {
            commands.push(command);
            return { exitCode: 0 };
          },
          log: () => {},
        },
      );

      expect(result.ok).toBe(true);
      expect(result.installed).toEqual(['jdk', 'maven']);
      expect(result.skipped).toEqual([]);
      expect(downloads.map((options) => options.url)).toEqual([JDK.url, MAVEN.url]);
      // The digest is the download's own gate: nothing reaches `tar` unverified.
      expect(downloads[0]?.verify).toBeFunction();
      expect(commands.map((command) => command.args.join(' '))).toEqual([
        `-xzf ${join(root, 'downloads', 'jdk.tar.gz')} -C ${join(root, 'jdk')} --strip-components=1`,
        `-xzf ${join(root, 'downloads', 'maven.tar.gz')} -C ${join(root, 'maven')} --strip-components=1`,
      ]);
      expect(readFileSync(join(root, 'jdk', '.stamp'), 'utf8').trim()).toBe(JDK.version);
      expect(result.env).toEqual(toolchainEnv(root));
      expect(result.env?.PATH.startsWith(join(root, 'jdk', 'bin'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reuses an installation stamped with the same version', async () => {
    const root = scratch();
    try {
      const downloads: DownloadOptions[] = [];
      const deps = {
        download: downloader(downloads),
        run: async () => ({ exitCode: 0 }),
        log: () => {},
      };

      await installToolchain({ root, artefacts: artefacts() }, deps);
      downloads.length = 0;
      const again = await installToolchain({ root, artefacts: artefacts() }, deps);

      expect(again.ok).toBe(true);
      expect(again.skipped).toEqual(['jdk', 'maven']);
      expect(again.installed).toEqual([]);
      expect(downloads).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('stops before extracting when the download cannot verify', async () => {
    const root = scratch();
    try {
      const commands: Command[] = [];
      const result = await installToolchain(
        { root, artefacts: artefacts() },
        {
          download: async () => ({
            ok: false,
            bytes: 3,
            resumedFrom: 0,
            attempts: 3,
            cached: false,
            message: 'the archive does not match its sha256',
          }),
          run: async (command) => {
            commands.push(command);
            return { exitCode: 0 };
          },
          log: () => {},
        },
      );

      expect(result.ok).toBe(false);
      expect(result.message).toContain('jdk');
      expect(result.message).toContain('does not match');
      expect(commands).toHaveLength(0);
      expect(existsSync(join(root, 'jdk'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('replaces an installation stamped with another version', async () => {
    const root = scratch();
    try {
      const deps = {
        download: downloader([]),
        run: async () => ({ exitCode: 0 }),
        log: () => {},
      };
      await installToolchain({ root, artefacts: artefacts() }, deps);
      writeFileSync(join(root, 'jdk', '.stamp'), '21.0.old\n');

      const again = await installToolchain({ root, artefacts: artefacts() }, deps);

      expect(again.installed).toContain('jdk');
      expect(readFileSync(join(root, 'jdk', '.stamp'), 'utf8').trim()).toBe(JDK.version);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installs into one ignored folder of the repository, and nowhere else in it', () => {
    // One folder inside the checkout, so nothing has to live outside the project...
    expect(toolchainRoot('/srv/sonora')).toBe('/srv/sonora/.tools/toolchain');
    // ...and that folder is the only place inside it a binary may land: anything else would be
    // tracked, which is how a 200 MB JDK ends up in a commit.
    expect(() => toolchainRoot('/srv/sonora', '/srv/sonora/scripts/jdk')).toThrow(/\.tools/);
    // An explicit override is still honoured, inside the ignored folder or outside the repo.
    expect(toolchainRoot('/srv/sonora', '/srv/sonora/.tools/jdk-21')).toBe(
      '/srv/sonora/.tools/jdk-21',
    );
    expect(toolchainRoot('/srv/sonora', '/opt/toolchain')).toBe('/opt/toolchain');
  });

  it('pins a real JDK 21 and a real Maven, with a published digest each', () => {
    const jdk = TOOLCHAIN.find((artefact) => artefact.name === 'jdk');
    const maven = TOOLCHAIN.find((artefact) => artefact.name === 'maven');
    if (!jdk || !maven) throw new Error('the toolchain is incomplete');

    // The profile's pom compiles with `maven.compiler.source=21`, so this is a floor, not taste.
    expect(jdk.version.startsWith('21.')).toBe(true);
    expect(jdk.digest.algorithm).toBe('sha256');
    expect(jdk.digest.value).toMatch(/^[0-9a-f]{64}$/);
    expect(jdk.url.startsWith('https://')).toBe(true);
    expect(maven.version).toMatch(/^3\.9\./);
    expect(maven.digest.algorithm).toBe('sha512');
    expect(maven.digest.value).toMatch(/^[0-9a-f]{128}$/);
  });
});
