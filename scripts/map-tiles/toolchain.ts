/**
 * scripts/map-tiles/toolchain.ts — the JDK and Maven a tile build needs, installed locally.
 *
 * The profile compiles with `maven.compiler.source=21`, so a machine with JDK 17 cannot build
 * it, and "install a JDK and Maven" is the step that turns a documented build into a build
 * nobody runs. This script is that step, pinned and verified:
 *
 * - **Nothing binary enters the repository.** The toolchain is installed outside it (under
 *   `~/.local/share/sonora-map-tiles/toolchain` by default, or wherever `--root` points), and
 *   the repository keeps only this file with the versions and digests.
 * - **Nothing is used before it is verified.** Both archives are checked against the digest the
 *   project publishes next to them (`sha256` for Adoptium, `sha512` for Apache) with the same
 *   downloader the tile build uses, so a truncated or wrong archive is refused instead of
 *   unpacked.
 * - **A second run is free.** Each installation is stamped with the version it came from, so a
 *   run that finds the right JDK does nothing, and one that finds another version replaces it.
 *
 * Usage:
 *   bun scripts/map-tiles/toolchain.ts [--root=<dir>]
 *
 * Then build with the environment it prints, or let `make map-tiles-build` pick it up.
 */
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Command, type CommandResult, runCommand } from './build';
import { type DownloadOptions, type DownloadResult, downloadVerified } from './download';

/** Where the toolchain lands when `--root` is not given: never inside the repository. */
export const DEFAULT_TOOLCHAIN_ROOT = join(
  homedir(),
  '.local',
  'share',
  'sonora-map-tiles',
  'toolchain',
);

const STAMP = '.stamp';
const DOWNLOADS = 'downloads';

export interface ToolchainArtefact {
  /** Directory under the toolchain root, and the name a failure reports. */
  name: 'jdk' | 'maven';
  version: string;
  url: string;
  /** The size the server publishes; a mismatch is caught by the digest anyway. */
  bytes: number;
  digest: { algorithm: 'sha256' | 'sha512'; value: string };
}

/**
 * The pinned toolchain.
 *
 * Adoptium publishes a `sha256` per release asset and Apache a `sha512` per binary; both are
 * re-read from the vendor when bumping, never copied from a download log.
 */
export const TOOLCHAIN: ToolchainArtefact[] = [
  {
    name: 'jdk',
    version: '21.0.13+9',
    url: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz',
    bytes: 207_858_352,
    digest: {
      algorithm: 'sha256',
      value: 'd7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c',
    },
  },
  {
    name: 'maven',
    version: '3.9.16',
    url: 'https://dlcdn.apache.org/maven/maven-3/3.9.16/binaries/apache-maven-3.9.16-bin.tar.gz',
    bytes: 9_300_000,
    digest: {
      algorithm: 'sha512',
      value:
        '831a8591fe20c8243b1dbe7d71e3244f31d1665b0804b2e825e38cbbe5ce0cafb8338851f90780735568773e0a6cd07bbec107cda0b896b008b861075358b6f6',
    },
  },
];

/**
 * Where the toolchain lives: outside the repository by default, or `--root`/`SONORA_TOOLCHAIN`.
 *
 * The repository path is accepted only to be refused: a toolchain inside it is a directory of
 * binaries that somebody eventually commits.
 */
export function defaultToolchainRoot(repoRoot: string, explicit?: string): string {
  if (explicit !== undefined && explicit.trim().length > 0) return resolve(explicit);
  const fromEnvironment = process.env.SONORA_TOOLCHAIN;
  if (fromEnvironment !== undefined && fromEnvironment.trim().length > 0) {
    return resolve(fromEnvironment);
  }
  const root = resolve(DEFAULT_TOOLCHAIN_ROOT);
  const repository = resolve(repoRoot);
  if (root === repository || root.startsWith(`${repository}/`)) {
    throw new Error(
      `the toolchain would live inside the repository at ${root}: binaries stay out of git, so point --root or SONORA_TOOLCHAIN somewhere else.`,
    );
  }
  return root;
}

/** The environment a build needs: `JAVA_HOME`, and both `bin` directories ahead of `PATH`. */
export function toolchainEnv(root: string): { JAVA_HOME: string; PATH: string } {
  const jdk = join(root, 'jdk');
  const maven = join(root, 'maven');
  return {
    JAVA_HOME: jdk,
    PATH: `${join(jdk, 'bin')}:${join(maven, 'bin')}:${process.env.PATH ?? ''}`,
  };
}

/** Streams a file through a digest, so a 200 MB archive never becomes a 200 MB buffer. */
export function checksumProblem(
  path: string,
  algorithm: 'sha256' | 'sha512',
  expected: string,
): string | null {
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const hash = createHash(algorithm);
    const buffer = Buffer.alloc(1024 * 1024);
    for (;;) {
      const read = readSync(fd, buffer, 0, buffer.length, null);
      if (read === 0) break;
      hash.update(buffer.subarray(0, read));
    }
    const actual = hash.digest('hex');
    if (actual === expected.toLowerCase()) return null;
    return `${path} does not match its published ${algorithm}: expected ${expected.toLowerCase()}, got ${actual}.`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `${path} cannot be read to verify it: ${reason}`;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

export interface ToolchainOptions {
  root: string;
  artefacts?: ToolchainArtefact[];
}

export interface ToolchainDeps {
  download?: (options: DownloadOptions) => Promise<DownloadResult>;
  run?: (command: Command) => Promise<CommandResult>;
  log?: (line: string) => void;
}

export interface ToolchainResult {
  ok: boolean;
  installed: string[];
  skipped: string[];
  env?: { JAVA_HOME: string; PATH: string };
  message?: string;
}

function stampedVersion(directory: string): string | null {
  try {
    return readFileSync(join(directory, STAMP), 'utf8').trim();
  } catch {
    return null;
  }
}

function sizeOfFile(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/**
 * Installs the pinned toolchain under `options.root`, skipping whatever is already there at the
 * pinned version, and stopping at the first artefact that cannot be verified or unpacked.
 */
export async function installToolchain(
  options: ToolchainOptions,
  deps: ToolchainDeps = {},
): Promise<ToolchainResult> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const run = deps.run ?? runCommand;
  const download = deps.download ?? downloadVerified;
  const artefacts = options.artefacts ?? TOOLCHAIN;
  const root = resolve(options.root);

  const installed: string[] = [];
  const skipped: string[] = [];
  const downloads = join(root, DOWNLOADS);
  mkdirSync(downloads, { recursive: true });

  for (const artefact of artefacts) {
    const directory = join(root, artefact.name);
    if (stampedVersion(directory) === artefact.version) {
      log(`${artefact.name} ${artefact.version} is already installed in ${directory}`);
      skipped.push(artefact.name);
      continue;
    }

    const archive = join(downloads, basename(artefact.url));
    log(`fetching ${artefact.name} ${artefact.version} (${artefact.bytes} bytes)`);
    const fetched = await download({
      url: artefact.url,
      destination: archive,
      // The digest is the gate: an archive that does not match is never unpacked.
      verify: (path) => checksumProblem(path, artefact.digest.algorithm, artefact.digest.value),
    });
    if (!fetched.ok) {
      return {
        ok: false,
        installed,
        skipped,
        message: `cannot install ${artefact.name}: ${fetched.message ?? 'the download failed'}`,
      };
    }

    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
    const extracted = await run({
      file: 'tar',
      args: ['-xzf', archive, '-C', directory, '--strip-components=1'],
      cwd: root,
    });
    if (extracted.exitCode !== 0) {
      return {
        ok: false,
        installed,
        skipped,
        message: `unpacking ${artefact.name} into ${directory} failed with exit code ${extracted.exitCode}${extracted.error === undefined ? '' : `: ${extracted.error}`}`,
      };
    }

    writeFileSync(join(directory, STAMP), `${artefact.version}\n`);
    log(`installed ${artefact.name} ${artefact.version} in ${directory}`);
    installed.push(artefact.name);
  }

  return { ok: true, installed, skipped, env: toolchainEnv(root) };
}

/** `--name=value` or `--name value`, the shape the other scripts in this directory use. */
function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const index = argv.indexOf(`--${name}`);
  if (inline !== undefined) return inline.slice(prefix.length);
  return index === -1 ? undefined : argv[index + 1];
}

async function main(argv: string[]): Promise<number> {
  const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  let root: string;
  try {
    root = defaultToolchainRoot(repoRoot, flag(argv, 'root'));
  } catch (error) {
    console.error(`map-tiles-toolchain: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const result = await installToolchain({ root });
  if (!result.ok) {
    console.error(`map-tiles-toolchain: ${result.message ?? 'the installation failed'}`);
    return 1;
  }

  console.log('');
  console.log(`toolchain root: ${root}`);
  for (const [name, value] of Object.entries(result.env ?? {})) {
    console.log(
      `  export ${name}="${name === 'PATH' ? `${join(root, 'jdk', 'bin')}:${join(root, 'maven', 'bin')}:$PATH` : value}"`,
    );
  }
  console.log('');
  console.log('Now build tiles with:');
  console.log('  make map-tiles-build REGION=calamuchita');
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
