/**
 * The config PR that makes a published version live.
 *
 * Publishing happens before the config moves: the objects are immutable and nobody reads them
 * until `/config` names their version, which is what keeps the move from ever pointing at
 * nothing. This is the other half — the branch, the commit and the pull request that move
 * `MAP_ARTIFACT_VERSION`, opened automatically and merged by a human.
 *
 * The property worth pinning is that it never touches the worktree: the commit is built through
 * a private index and written straight to a branch, so an operator's uncommitted work is not
 * carried into the config PR and no checkout ever moves under it.
 */
import { describe, expect, it } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CONFIG_PATHS,
  branchName,
  bumpConfig,
  bumpVersion,
  versionProblem,
  type CommandResult,
  type RunCommand,
} from '../bump-version';

const CONFIG = `[vars]
ENVIRONMENT = "staging"

# Published once per version: bump this before publishing anything new.
MAP_ARTIFACT_VERSION = "v1"
MAP_RENDERER = "leaflet"
`;

describe('versionProblem', () => {
  it('accepts a version the client can key a file by', () => {
    expect(versionProblem('v2')).toBeNull();
    expect(versionProblem('20261103a')).toBeNull();
    expect(versionProblem('v2.1')).toBeNull();
  });

  it('refuses a dash, because the archive file name is region-version-origin', () => {
    expect(versionProblem('2026-11-03')).toContain('dash');
  });

  it('refuses what is not a version segment at all', () => {
    expect(versionProblem('')).not.toBeNull();
    expect(versionProblem(' v2')).not.toBeNull();
    expect(versionProblem('v2/3')).not.toBeNull();
  });
});

describe('bumpConfig', () => {
  it('replaces the version and leaves the comment and every other key alone', () => {
    const next = bumpConfig(CONFIG, 'v2');
    expect(next).toContain('MAP_ARTIFACT_VERSION = "v2"');
    expect(next).toContain(
      '# Published once per version: bump this before publishing anything new.',
    );
    expect(next).toContain('MAP_RENDERER = "leaflet"');
    expect(next).not.toContain('MAP_ARTIFACT_VERSION = "v1"');
  });

  it('says so when there is no version to replace', () => {
    expect(() => bumpConfig('[vars]\nMAP_RENDERER = "leaflet"\n', 'v2')).toThrow(
      /MAP_ARTIFACT_VERSION/,
    );
  });

  it('refuses an ambiguous config instead of guessing which line to rewrite', () => {
    expect(() => bumpConfig(`${CONFIG}MAP_ARTIFACT_VERSION = "v0"\n`, 'v2')).toThrow(/twice/);
  });

  it('names the branch after the environment and the version, so the two never collide', () => {
    expect(branchName('staging', 'v2')).toBe('chore/map-artifact-version-staging-v2');
    expect(branchName('production', 'v2')).toBe('chore/map-artifact-version-production-v2');
    // The documented examples use one version for both environments: one branch would mean the
    // production run force-updating the staging branch and landing under its pull request.
    expect(branchName('staging', 'v2')).not.toBe(branchName('production', 'v2'));
  });
});

/** A repository shaped like this one, with `origin/main` holding the config to bump. */
function scratchRepo(): {
  root: string;
  branch: () => string;
  diskVersion: () => string;
  /** What a merge of the config PR looks like: `origin/main` moves onto that branch. */
  promoteToMain: (branch: string) => void;
} {
  const root = mkdtempSync(join(tmpdir(), 'map-tiles-bump-'));
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
  const origin = join(root, 'origin.git');
  execFileSync('git', ['init', '--quiet', '--bare', '-b', 'main', origin], {
    encoding: 'utf8',
    env,
  });
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  const git = (args: string[], cwd = work): string =>
    execFileSync('git', args, { cwd, encoding: 'utf8', env });
  git(['init', '--quiet', '-b', 'main']);
  git(['config', 'user.name', 't']);
  git(['config', 'user.email', 't@example.invalid']);
  mkdirSync(join(work, 'apps/api'), { recursive: true });
  writeFileSync(join(work, CONFIG_PATHS.staging), CONFIG);
  git(['add', '.']);
  git(['commit', '-q', '-m', 'main']);
  git(['remote', 'add', 'origin', origin]);
  git(['push', '--quiet', 'origin', 'main']);
  // An operator's own work in progress, which the config commit must not carry.
  writeFileSync(join(work, CONFIG_PATHS.staging), CONFIG + '# local edit\n');
  git(['checkout', '-q', '-b', 'feat/something']);

  return {
    root: work,
    branch: () => git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    diskVersion: () => readFileSync(join(work, CONFIG_PATHS.staging), 'utf8'),
    promoteToMain: (branch: string) => {
      git(['push', '--quiet', 'origin', `${branch}:main`]);
      git(['fetch', '--quiet', 'origin', 'main']);
    },
  };
}

/** A runner whose `git push` fails, as a network drop or a rejected ref would. */
function failingPush(): { run: RunCommand; fetchStatus: (url: string) => Promise<number> } {
  const { run, fetchStatus } = recorder();
  return {
    run: async (command) => {
      if (command.file === 'git' && command.args.includes('push')) {
        return { exitCode: 1, stdout: '', stderr: 'the remote hung up' } as CommandResult;
      }
      return run(command);
    },
    fetchStatus,
  };
}

/**
 * Records what the script asked for, runs the git it asks for for real, and answers `gh`.
 *
 * The git commands are not stubbed on purpose: the property under test is that the commit is
 * assembled through a private index, and a fake runner would prove a fake.
 */
function recorder(): {
  calls: { file: string; args: string[] }[];
  run: RunCommand;
  fetchStatus: (url: string) => Promise<number>;
} {
  const calls: { file: string; args: string[] }[] = [];
  const run: RunCommand = async (command: {
    file: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    input?: string;
  }) => {
    calls.push({ file: command.file, args: command.args });
    if (command.file === 'gh') {
      return { exitCode: 0, stdout: 'https://github.com/masch/sonora/pull/999', stderr: '' };
    }
    const result = spawnSync(command.file, command.args, {
      cwd: command.cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...command.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
      },
      input: command.input,
    });
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    } as CommandResult;
  };
  // Both objects of the version are published, which is what a real publish leaves behind.
  return { calls, run, fetchStatus: async () => 200 };
}

describe('bumpVersion', () => {
  it('writes the version to a branch without touching the worktree or the current branch', async () => {
    const repo = scratchRepo();
    const before = repo.diskVersion();
    const { calls, run, fetchStatus } = recorder();
    try {
      const result = await bumpVersion(
        { environment: 'staging', version: 'v2', region: 'calamuchita', archivePath: null },
        { run, fetchStatus, repoRoot: repo.root, git: realGit(repo.root) },
      );

      expect(result.ok).toBe(true);
      expect(result.branch).toBe('chore/map-artifact-version-staging-v2');
      expect(result.prUrl).toBe('https://github.com/masch/sonora/pull/999');
      // The operator is still on their own branch, with their own edit still on disk.
      expect(repo.branch()).toBe('feat/something');
      expect(repo.diskVersion()).toBe(before);
      // And the config commit carries the bump alone.
      const committed = realGit(repo.root)([
        'show',
        'chore/map-artifact-version-staging-v2:apps/api/wrangler.staging.toml',
      ]);
      expect(committed).toContain('MAP_ARTIFACT_VERSION = "v2"');
      expect(committed).not.toContain('local edit');
      // The PR is opened against main, with the branch as its head.
      const pr = calls.find((call) => call.file === 'gh');
      expect(pr?.args).toContain('--base');
      expect(pr?.args).toContain('main');
      expect(pr?.args).toContain('chore/map-artifact-version-staging-v2');
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  it('does nothing once origin/main itself names that version', async () => {
    const repo = scratchRepo();
    const { calls, run, fetchStatus } = recorder();
    try {
      const first = await bumpVersion(
        { environment: 'staging', version: 'v2', region: 'calamuchita', archivePath: null },
        { run, fetchStatus, repoRoot: repo.root, git: realGit(repo.root) },
      );
      expect(first.ok).toBe(true);

      // The PR merged: the only state that means "this version is already in the config".
      repo.promoteToMain('chore/map-artifact-version-staging-v2');

      const second = await bumpVersion(
        { environment: 'staging', version: 'v2', region: 'calamuchita', archivePath: null },
        { run, fetchStatus, repoRoot: repo.root, git: realGit(repo.root) },
      );
      expect(second.ok).toBe(true);
      expect(second.alreadyCurrent).toBe(true);
      expect(calls.filter((call) => call.file === 'gh')).toHaveLength(1);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  it('retries the push and the pull request when the previous run died before GitHub', async () => {
    const repo = scratchRepo();
    const failing = failingPush();
    try {
      // The local branch is created before the push, so a failure here leaves one behind that
      // must not be mistaken for a completed run.
      const failed = await bumpVersion(
        { environment: 'staging', version: 'v2', region: 'calamuchita', archivePath: null },
        {
          run: failing.run,
          fetchStatus: failing.fetchStatus,
          repoRoot: repo.root,
          git: realGit(repo.root),
        },
      );
      expect(failed.ok).toBe(false);
      expect(failed.message).toContain('push');

      const retry = recorder();
      const second = await bumpVersion(
        { environment: 'staging', version: 'v2', region: 'calamuchita', archivePath: null },
        {
          run: retry.run,
          fetchStatus: retry.fetchStatus,
          repoRoot: repo.root,
          git: realGit(repo.root),
        },
      );
      expect(second.ok).toBe(true);
      expect(second.prUrl).toBe('https://github.com/masch/sonora/pull/999');
      // The retry really pushed and really asked for a PR, instead of trusting the local branch.
      expect(retry.calls.filter((call) => call.args.includes('push'))).toHaveLength(1);
      expect(retry.calls.filter((call) => call.file === 'gh')).toHaveLength(1);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  it('refuses a version nobody published, so the config never names a missing object', async () => {
    const repo = scratchRepo();
    const { calls, run, fetchStatus } = recorder();
    try {
      const result = await bumpVersion(
        { environment: 'staging', version: 'v9', region: 'calamuchita', archivePath: null },
        {
          run,
          // Neither object of v9 exists: a config PR for it would make `/config` omit the region.
          fetchStatus: async (url) => (url.includes('/tiles/') ? 404 : 200),
          repoRoot: repo.root,
          git: realGit(repo.root),
        },
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain('v9');
      expect(result.message).toContain('tiles/calamuchita/v9.pmtiles');
      expect(calls.filter((call) => call.file === 'gh')).toHaveLength(0);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  it('reads and writes nothing at all in a dry run', async () => {
    const repo = scratchRepo();
    const { calls, run, fetchStatus } = recorder();
    try {
      const result = await bumpVersion(
        { environment: 'staging', version: 'v2', region: 'calamuchita', archivePath: null },
        { run, fetchStatus, repoRoot: repo.root, git: realGit(repo.root), dryRun: true },
      );

      expect(result.ok).toBe(true);
      expect(result.body).toContain('v2');
      // A fetch writes remote-tracking refs and FETCH_HEAD, and the dry run promises it does not.
      expect(calls.filter((call) => call.args.includes('fetch'))).toHaveLength(0);
      expect(calls.filter((call) => call.args.includes('push'))).toHaveLength(0);
      expect(calls.filter((call) => call.file === 'gh')).toHaveLength(0);
      expect(calls.filter((call) => call.args.includes('branch'))).toHaveLength(0);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  it('refuses a dash in the version before it writes anything', async () => {
    const repo = scratchRepo();
    const { calls, run, fetchStatus } = recorder();
    try {
      const result = await bumpVersion(
        { environment: 'staging', version: '2026-11-03', region: 'calamuchita', archivePath: null },
        { run, fetchStatus, repoRoot: repo.root, git: realGit(repo.root) },
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain('dash');
      expect(calls).toEqual([]);
      expect(
        existsSync(
          join(repo.root, '.git', 'refs', 'heads', 'chore', 'map-artifact-version-2026-11-03'),
        ),
      ).toBe(false);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });
});

/** The real git of the scratch repository, for the assertions and the plumbing it needs. */
function realGit(root: string): (args: string[]) => string {
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
  return (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env });
}
