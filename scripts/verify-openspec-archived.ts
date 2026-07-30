import fs from 'node:fs';
import path from 'node:path';

export function checkUnarchivedChanges(rootDir: string = process.cwd()): {
  unarchived: string[];
  ok: boolean;
} {
  const changesDir = path.join(rootDir, 'openspec', 'changes');

  if (!fs.existsSync(changesDir)) {
    return { unarchived: [], ok: true };
  }

  const entries = fs.readdirSync(changesDir, { withFileTypes: true });
  const pendingOrCompleted = entries.filter((e) => {
    if (e.name.startsWith('.') || e.name === 'archive') return false;
    return true;
  });

  const unarchived: string[] = [];

  for (const entry of pendingOrCompleted) {
    const entryPath = path.join(changesDir, entry.name);
    if (entry.isDirectory()) {
      const taskFile = path.join(entryPath, 'tasks.md');
      if (fs.existsSync(taskFile)) {
        const content = fs.readFileSync(taskFile, 'utf-8');
        const lines = content.split('\n');
        const hasTasks = lines.some((line) => /^\s*-\s*\[[ x]\]/.test(line));
        const hasUnchecked = lines.some((line) => /^\s*-\s*\[\s*\]/.test(line));
        if (hasTasks && !hasUnchecked) {
          unarchived.push(entry.name);
        }
      }
    }
  }

  return {
    unarchived,
    ok: unarchived.length === 0,
  };
}

export function runCLI(
  rootDir: string = process.cwd(),
  logger: { error: typeof console.error; log: typeof console.log } = console,
): number {
  const { unarchived, ok } = checkUnarchivedChanges(rootDir);

  if (!ok) {
    logger.error(
      `\x1b[31m[OpenSpec CI Error]\x1b[0m The following completed changes in 'openspec/changes/' must be moved to 'openspec/archived/':`,
    );
    for (const name of unarchived) {
      logger.error(`  - openspec/changes/${name}`);
    }
    return 1;
  }

  logger.log(
    '\x1b[32m[OpenSpec CI Check]\x1b[0m All completed OpenSpec changes are properly archived or pending.',
  );
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-openspec-archived.ts')) {
  const exitCode = runCLI();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
