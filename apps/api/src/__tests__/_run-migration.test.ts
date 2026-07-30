import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

const SCRIPT = 'scripts/migrations/_run-migration.ts';
const CWD = process.cwd();

interface ExecResult {
  stdout: string;
  stderr: string;
}

function run(args: string): ExecResult {
  try {
    const stdout = execSync(`bun run ${SCRIPT} ${args}`, {
      cwd: CWD,
      encoding: 'utf-8',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'libsql://dummy.turso.io',
      },
    }) as unknown as string;
    return { stdout, stderr: '' };
  } catch (err: unknown) {
    const error = err as Record<string, unknown>;
    return {
      stdout: typeof error.stdout === 'string' ? error.stdout : '',
      stderr: typeof error.stderr === 'string' ? error.stderr : '',
    };
  }
}

describe('_run-migration.ts', () => {
  it('lists available migrations when no argument is given', () => {
    const { stdout, stderr } = run('');
    const output = stdout + stderr;

    expect(output).toContain('device-id/');
  });

  it('outputs usage instructions when no argument is given', () => {
    const { stdout, stderr } = run('');
    const output = stdout + stderr;

    expect(output).toContain('MIGRATION=<dirname>');
    expect(output).toContain('LIVE=1');
  });

  it('shows error for a non-existent migration', () => {
    const { stdout, stderr } = run('no-existe.ts');
    const output = stdout + stderr;

    expect(output).toContain('Migration "no-existe.ts" not found');
  });

  it('runs an existing migration and shows its startup log', () => {
    const { stdout, stderr } = run('device-id/');
    const output = stdout + stderr;

    // The migration starts up, tries DB connection, and logs the migration name
    expect(output).toContain('Running migration: Device ID SHA-256 hashing');
  });
});
