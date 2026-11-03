/**
 * scripts/map-tiles/bump-version.ts — the config PR that makes a published version live.
 *
 * Publishing and going live are two steps on purpose. The artifacts are immutable and opaque:
 * nothing reads `tiles/<region>/<version>.pmtiles` until `/config` names that version, and
 * `/config` omits a region whose object is missing. So the safe order is publish first (the bytes
 * land and nobody sees them), then move the version — never the other way, which would point
 * clients at an object that does not exist yet.
 *
 * This script is the second step, and it is a pull request rather than a commit because
 * `MAP_ARTIFACT_VERSION` is a `[vars]` entry in the Worker config: moving it is a deploy of the
 * API, and that follows the repository's ordinary policy — a branch, a commit, a PR, a human
 * deciding when it merges. Merging it triggers the deploy workflow, so the merge is the go-live.
 *
 * **It never touches the worktree.** The commit is built through a private index
 * (`GIT_INDEX_FILE`) against `origin/main` and written straight to its branch, so an operator's
 * uncommitted work is never carried into the config PR and no checkout moves under the editor.
 *
 * Usage:
 *   bun scripts/map-tiles/bump-version.ts --version=v2 [--environment=staging] \
 *     [--region=calamuchita] [--archive=<cache>/out/calamuchita.pmtiles]
 *
 * Exit 0 means the branch is pushed and the pull request exists (or already existed). 1 names the
 * reason nothing was opened. `--dry-run` prints the branch, the commit subject and the PR body
 * without writing, pushing or opening anything.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The Worker config each environment derives its artifact urls from. */
export const CONFIG_PATHS = {
  staging: 'apps/api/wrangler.staging.toml',
  production: 'apps/api/wrangler.toml',
} as const;

export type BumpEnvironment = keyof typeof CONFIG_PATHS;

/** Where each environment serves its artifacts: the check reads the route clients read. */
export const API_BASES: Record<BumpEnvironment, string> = {
  staging: 'https://sonora-api-staging.sonora-api.workers.dev',
  production: 'https://sonora-api.sonora-api.workers.dev',
};

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface Command {
  file: string;
  args: string[];
  cwd: string;
  /** Extra environment for this command, merged over the process's own. */
  env?: Record<string, string>;
  /** Written to the command's stdin, for the git plumbing that reads a blob from there. */
  input?: string;
}

/** Runs one command. `gh` is the only thing here that talks to the network by itself. */
export type RunCommand = (command: Command) => Promise<CommandResult>;

export interface BumpInput {
  environment: BumpEnvironment;
  version: string;
  region: string;
  /** Overrides the environment's origin, for a local or a renamed deployment. */
  apiBase?: string;
  /** The archive this publish produced, when the caller has one: it feeds the PR body. */
  archivePath: string | null;
}

export interface BumpDeps {
  run?: RunCommand;
  /** `HEAD <url>` answered with its status: how the run proves the version exists. */
  fetchStatus?: (url: string) => Promise<number>;
  /** Read-only git, answered with stdout; the plumbing that writes goes through `run`. */
  git?: (args: string[]) => string;
  repoRoot?: string;
  dryRun?: boolean;
}

export interface BumpResult {
  ok: boolean;
  message?: string;
  branch?: string;
  prUrl?: string;
  /** The config already named this version, so nothing was opened. */
  alreadyCurrent?: boolean;
  /** What the run would do, filled in `--dry-run`. */
  body?: string;
}

const VERSION_FORBIDDEN = /[^A-Za-z0-9._]/;
const VERSION_LINE = /^[ \t]*MAP_ARTIFACT_VERSION[ \t]*=[ \t]*"[^"]*"[ \t]*$/m;
const VERSION_VALUE = /^[ \t]*MAP_ARTIFACT_VERSION[ \t]*=[ \t]*"([^"]*)"[ \t]*$/m;

/**
 * The version the config text already names, or `null` when it names none.
 *
 * Compared as a value rather than as text: `MAP_ARTIFACT_VERSION="v2"` and
 * `MAP_ARTIFACT_VERSION = "v2"` are the same configuration, and rewriting one into the other is
 * a pull request that changes nothing.
 */
export function configVersion(text: string): string | null {
  return VERSION_VALUE.exec(text)?.[1] ?? null;
}

/**
 * Why a version cannot be a published one, or `null` when it can.
 *
 * The client names the file it downloads `<region>-<version>-<origin>.pmtiles`, so a dash inside
 * the version would be indistinguishable from the separators around it and `map-archives.ts`
 * would refuse the url — the device would never key the archive it just downloaded.
 */
export function versionProblem(version: string): string | null {
  if (version.trim().length === 0) return 'the version is empty';
  if (version.trim() !== version) return `the version "${version}" has surrounding whitespace`;
  if (version.includes('-')) {
    return `the version "${version}" contains a dash, and a dash is part of the archive file name (region-version-origin): pick something like v3 or 20261103a`;
  }
  if (VERSION_FORBIDDEN.test(version)) {
    return `the version "${version}" holds a character the archive file name cannot carry: use letters, digits, dots and underscores`;
  }
  return null;
}

/**
 * The config text with the artifact version replaced, and every other byte left alone.
 *
 * A config with no such line cannot be bumped — the run would otherwise report success having
 * changed nothing — and one with two is refused rather than guessed at: replacing the wrong line
 * moves the wrong environment.
 */
export function bumpConfig(text: string, version: string): string {
  const matches = text.match(new RegExp(VERSION_LINE.source, 'gm')) ?? [];
  if (matches.length === 0) {
    throw new Error('the config has no MAP_ARTIFACT_VERSION line to bump');
  }
  if (matches.length > 1) {
    throw new Error(
      'the config carries MAP_ARTIFACT_VERSION twice, so which line to bump is a guess',
    );
  }
  return text.replace(VERSION_LINE, `MAP_ARTIFACT_VERSION = "${version}"`);
}

/**
 * The branch a config PR lives on: one per environment **and** version.
 *
 * Keying it by version alone collides the two environments, because the documented examples use
 * the same version for both: a production run would force-update the staging branch, land
 * production's config under a staging PR, and then read `gh`'s "a pull request already exists" as
 * success — so production's PR never opens and staging's PR carries the wrong environment.
 */
export function branchName(environment: BumpEnvironment, version: string): string {
  return `chore/map-artifact-version-${environment}-${version}`;
}

function commitSubject(version: string): string {
  return `chore(api): move the published map artifact version to ${version}`;
}

function prTitle(version: string): string {
  return `chore(api): move the published map artifact version to ${version}`;
}

/** What the PR says: which version, which region, which bytes, and what merging does. */
function prBody(input: BumpInput, published: { bytes: number; sha256: string } | null): string {
  const lines = [
    `Moves \`MAP_ARTIFACT_VERSION\` in \`${CONFIG_PATHS[input.environment]}\` to \`${input.version}\`.`,
    '',
    'Published before this PR, so nothing points at a missing object:',
    '',
    `- region: \`${input.region}\``,
    `- archive: \`tiles/${input.region}/${input.version}.pmtiles\``,
    `- style: \`styles/${input.version}.json\``,
  ];

  if (published !== null) {
    lines.push(`- archive bytes: ${published.bytes}`, `- archive sha256: \`${published.sha256}\``);
  }

  lines.push(
    '',
    '## What merging does',
    '',
    '`/config` starts naming this version for every client, and the API deploy workflow runs on',
    'the push to `main`, so the merge is the go-live. Clients already holding an archive of another',
    'version key download this one on their next mount — the file name carries the version.',
    '',
    '## Rolling back',
    '',
    'Revert this PR and merge it: `/config` returns to the previous version, whose objects are',
    'still there because a published version is never rewritten.',
  );

  return `${lines.join('\n')}\n`;
}

/** The digest and size of the archive this publish produced, or `null` when none was given. */
function publishedArchive(path: string | null): { bytes: number; sha256: string } | null {
  if (path === null) return null;
  const bytes = readFileSync(resolve(path));
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/** `HEAD` on the media route: no archive is downloaded to ask whether it exists. */
async function defaultFetchStatus(url: string): Promise<number> {
  return (await fetch(url, { method: 'HEAD' })).status;
}

/**
 * A PATH a spawned child can actually use.
 *
 * A shell expands `~` in its own PATH; `execvp` does not, so a machine whose PATH carries a
 * literal `~/dev/…/bin` finds its tools interactively and loses them to a child process. Here
 * `gh` is exactly that: the run reported an empty failure because the executable was never found.
 */
export function expandPath(value: string, home = process.env.HOME ?? ''): string {
  return value
    .split(':')
    .map((entry) =>
      entry === '~' ? home : entry.startsWith('~/') ? join(home, entry.slice(2)) : entry,
    )
    .join(':');
}

/**
 * The arguments that write the config commit, signed when the repository asks for it.
 *
 * `git commit-tree` is plumbing: it runs no hook and signs nothing unless told, so a repository
 * whose policy is signed commits (branch protection checks it) would get an unsigned one from a
 * script that looked like it obeyed. `-S` makes signing the repository's decision, not ours.
 */
export function commitTreeArgs(input: {
  tree: string;
  parent: string;
  subject: string;
  sign: boolean;
}): string[] {
  return [
    'commit-tree',
    input.tree,
    '-p',
    input.parent,
    ...(input.sign ? ['-S'] : []),
    '-m',
    input.subject,
  ];
}

/** The production seams: a real process runner, the repository's own git, and its root. */
function defaultRun(): RunCommand {
  return async (command) => {
    const { spawnSync } = await import('node:child_process');
    const env = { ...process.env, ...command.env };
    const result = spawnSync(command.file, command.args, {
      cwd: command.cwd,
      encoding: 'utf8',
      env: { ...env, PATH: expandPath(env.PATH ?? '') },
      input: command.input,
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? '',
      // A child that could not be spawned at all has no stderr, and losing that reason is how a
      // publish reported `gh pr create failed:` with nothing after it.
      stderr: result.stderr || (result.error === undefined ? '' : result.error.message),
    };
  };
}

/**
 * Bump the config on its own branch, push it and open the PR. Never touches the worktree.
 *
 * Everything that writes is a `run` command so a test owns the repository it writes to; the
 * commit itself is assembled from a private index, which is what keeps the operator's tree and
 * branch untouched.
 */
export async function bumpVersion(input: BumpInput, deps: BumpDeps = {}): Promise<BumpResult> {
  const problem = versionProblem(input.version);
  if (problem !== null) return { ok: false, message: problem };

  const repoRoot = resolve(deps.repoRoot ?? '.');
  const run = deps.run ?? defaultRun();
  const dryRun = deps.dryRun === true;
  const git =
    deps.git ??
    ((args: string[]) => {
      const { spawnSync } = require('node:child_process') as typeof import('node:child_process');
      const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
      if (result.status !== 0) {
        throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
      }
      return result.stdout;
    });

  const path = CONFIG_PATHS[input.environment];
  // A config PR naming a version nobody published is an outage waiting for a merge: `/config`
  // builds the catalog with a HEAD on the object and omits a region whose object is missing.
  const apiBase = input.apiBase ?? API_BASES[input.environment];
  const missing: string[] = [];
  for (const key of [
    `tiles/${input.region}/${input.version}.pmtiles`,
    `styles/${input.version}.json`,
  ]) {
    const status = await (deps.fetchStatus ?? defaultFetchStatus)(`${apiBase}/media/public/${key}`);
    if (status !== 200) missing.push(`${key} (${status})`);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      message: `nothing is published under ${input.version} in ${input.environment}: ${missing.join(', ')}. Publish it first: a config PR that names it would make /config omit the region until the objects exist.`,
    };
  }

  const branch = branchName(input.environment, input.version);

  // `--dry-run` means no write anywhere, and a fetch writes remote-tracking refs and FETCH_HEAD.
  // The dry run therefore reads whatever `origin/main` the repository already has, and says so.
  if (!dryRun) {
    const fetched = await run({
      file: 'git',
      args: ['fetch', 'origin', 'main', '--quiet'],
      cwd: repoRoot,
    });
    if (fetched.exitCode !== 0) {
      return {
        ok: false,
        message: `git fetch origin main failed, so every commit would be based on a stale ref: ${fetched.stderr.trim()}`,
      };
    }
  }

  const parent = git(['rev-parse', 'origin/main']).trim();
  const current = git(['show', `${parent}:${path}`]);

  try {
    // Compared as a value, not as text: a config that already says `v2` in another spacing is
    // done, and a pull request that only reformats it is noise.
    if (configVersion(current) === input.version) {
      return {
        ok: true,
        alreadyCurrent: true,
        message: `origin/main already names ${input.version}`,
      };
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  // No early return on a local branch: the branch is created here, so a run that failed at the
  // push or at `gh pr create` leaves one behind that proves nothing. A re-run redoes both, and
  // `gh` answering "a pull request already exists" is the only re-run state worth trusting.
  const next = bumpConfig(current, input.version);
  const published = publishedArchive(input.archivePath);
  const body = prBody(input, published);

  if (dryRun) {
    return {
      ok: true,
      branch,
      body,
      message:
        'dry run: nothing was written, pushed or opened, and origin/main was read as it already is',
    };
  }

  const indexDir = mkdtempSync(join(tmpdir(), 'map-tiles-bump-index-'));
  const indexEnv = { GIT_INDEX_FILE: join(indexDir, 'index') };
  try {
    const blob = await run({
      file: 'git',
      args: ['hash-object', '-w', '--stdin'],
      cwd: repoRoot,
      input: next,
    });
    if (blob.exitCode !== 0)
      return { ok: false, message: `git hash-object failed: ${blob.stderr.trim()}` };

    const steps: Command[] = [
      { file: 'git', args: ['read-tree', parent], cwd: repoRoot, env: indexEnv },
      {
        file: 'git',
        args: ['update-index', '--add', '--cacheinfo', `100644,${blob.stdout.trim()},${path}`],
        cwd: repoRoot,
        env: indexEnv,
      },
      { file: 'git', args: ['write-tree'], cwd: repoRoot, env: indexEnv },
    ];
    let tree = '';
    for (const step of steps) {
      const result = await run(step);
      if (result.exitCode !== 0) {
        return { ok: false, message: `git ${step.args[0]} failed: ${result.stderr.trim()}` };
      }
      if (step.args[0] === 'write-tree') tree = result.stdout.trim();
    }

    let sign = false;
    try {
      sign = git(['config', '--get', 'commit.gpgsign']).trim() === 'true';
    } catch {
      // No such key means the repository does not ask for signatures.
      sign = false;
    }

    const committed = await run({
      file: 'git',
      args: commitTreeArgs({ tree, parent, subject: commitSubject(input.version), sign }),
      cwd: repoRoot,
    });
    if (committed.exitCode !== 0) {
      return { ok: false, message: `git commit-tree failed: ${committed.stderr.trim()}` };
    }
    const commit = committed.stdout.trim();

    const branched = await run({
      file: 'git',
      args: ['branch', '-f', branch, commit],
      cwd: repoRoot,
    });
    if (branched.exitCode !== 0) {
      return { ok: false, message: `git branch failed: ${branched.stderr.trim()}` };
    }

    // `--force-with-lease` on purpose: the branch is this script's own, and a re-run that finds a
    // different commit there is replacing its own previous attempt, not somebody else's work.
    const pushed = await run({
      file: 'git',
      args: ['push', '--force-with-lease', 'origin', branch],
      cwd: repoRoot,
    });
    if (pushed.exitCode !== 0) {
      return { ok: false, message: `git push failed: ${pushed.stderr.trim()}` };
    }

    const bodyPath = join(indexDir, 'pr.md');
    writeFileSync(bodyPath, body);
    const opened = await run({
      file: 'gh',
      args: [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        branch,
        '--title',
        prTitle(input.version),
        '--body-file',
        bodyPath,
        '--label',
        'type:chore',
      ],
      cwd: repoRoot,
    });

    if (opened.exitCode !== 0) {
      // A PR for this head that already exists is the state a re-run wants, not a failure — and
      // which stream carries that sentence is `gh`'s business, not ours.
      const said = `${opened.stderr}\n${opened.stdout}`;
      if (/already exists/i.test(said)) {
        return { ok: true, branch, message: `a pull request for ${branch} already exists` };
      }
      return {
        ok: false,
        message: `gh pr create failed: ${said.trim() || 'the command exited non-zero and said nothing'}`,
      };
    }

    return { ok: true, branch, prUrl: opened.stdout.trim() || undefined };
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
  }
}

const USAGE = [
  'Usage:',
  '  bun scripts/map-tiles/bump-version.ts --version=v2 [--environment=staging|production] \\',
  '    [--region=calamuchita] [--archive=<cache>/out/calamuchita.pmtiles] [--dry-run]',
  '  bun scripts/map-tiles/bump-version.ts --check-version=v3   # is this a version a device can key?',
].join('\n');

/** `--name=value` or `--name value`, the same shape the other scripts use. */
function flag(argv: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const index = argv.indexOf(`--${name}`);
  if (inline === undefined && index === -1) return undefined;
  const value = inline !== undefined ? inline.slice(prefix.length) : (argv[index + 1] ?? '');
  return value.trim().length === 0 ? undefined : value;
}

async function main(argv: string[]): Promise<number> {
  // `--check-version` is the same argument under the name the publish target uses: the check is
  // reachable on its own, without a `--version` beside it.
  const version = flag(argv, 'version') ?? flag(argv, 'check-version');
  if (version === undefined) {
    console.error(`map-tiles-bump-version: --version is required.\n\n${USAGE}`);
    return 1;
  }

  if (argv.some((arg) => arg === '--check-version' || arg.startsWith('--check-version='))) {
    const problem = versionProblem(version);
    if (problem !== null) {
      console.error(`map-tiles-bump-version: ${problem}`);
      return 1;
    }
    return 0;
  }

  const environment = flag(argv, 'environment') ?? 'staging';
  if (environment !== 'staging' && environment !== 'production') {
    console.error(`map-tiles-bump-version: --environment must be staging or production.`);
    return 1;
  }

  const result = await bumpVersion(
    {
      environment,
      version,
      region: flag(argv, 'region') ?? 'calamuchita',
      archivePath: flag(argv, 'archive') ?? null,
      apiBase: flag(argv, 'api'),
    },
    {
      dryRun: argv.includes('--dry-run'),
      repoRoot: fileURLToPath(new URL('../..', import.meta.url)),
    },
  );

  if (result.body !== undefined) console.log(result.body);
  if (result.prUrl !== undefined) console.log(`  opened: ${result.prUrl}`);
  if (result.branch !== undefined) console.log(`  branch: ${result.branch}`);
  if (!result.ok) {
    console.error(`map-tiles-bump-version: ${result.message ?? 'the config PR was not opened'}`);
    return 1;
  }
  if (result.message !== undefined) console.log(`  ${result.message}`);
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        `map-tiles-bump-version: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
