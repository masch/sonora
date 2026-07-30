import fs from 'node:fs';
import path from 'node:path';

export function checkUnarchivedChanges(rootDir: string = process.cwd()): {
  unarchived: string[];
  incompleteArchived: string[];
  ok: boolean;
} {
  const changesDir = path.join(rootDir, 'openspec', 'changes');
  const unarchived: string[] = [];

  if (fs.existsSync(changesDir)) {
    const entries = fs.readdirSync(changesDir, { withFileTypes: true });
    const pendingOrCompleted = entries.filter((e) => {
      if (e.name.startsWith('.') || e.name === 'archive') return false;
      return true;
    });

    for (const entry of pendingOrCompleted) {
      unarchived.push(entry.name);
    }
  }

  const archivedDir = path.join(rootDir, 'openspec', 'archived');
  const incompleteArchived: string[] = [];

  if (fs.existsSync(archivedDir)) {
    const archivedEntries = fs.readdirSync(archivedDir, { withFileTypes: true });
    for (const entry of archivedEntries) {
      if (entry.name.startsWith('.')) continue;
      const entryPath = path.join(archivedDir, entry.name);
      if (entry.isDirectory()) {
        const taskFile = path.join(entryPath, 'tasks.md');
        if (fs.existsSync(taskFile)) {
          const content = fs.readFileSync(taskFile, 'utf-8');
          const lines = content.split('\n');
          const hasUnchecked = lines.some((line) => /^\s*-\s*\[\s*\]/.test(line));
          if (hasUnchecked) {
            incompleteArchived.push(entry.name);
          }
        }
      }
    }
  }

  return {
    unarchived,
    incompleteArchived,
    ok: unarchived.length === 0 && incompleteArchived.length === 0,
  };
}

export function runCLI(
  rootDir: string = process.cwd(),
  logger: { error: typeof console.error; log: typeof console.log } = console,
): number {
  const { unarchived, incompleteArchived, ok } = checkUnarchivedChanges(rootDir);

  if (!ok) {
    if (unarchived.length > 0) {
      logger.error(
        `\x1b[31m[OpenSpec CI Error]\x1b[0m OpenSpec changes directory MUST be empty. The following items in 'openspec/changes/' must be moved to 'openspec/archived/':`,
      );
      for (const name of unarchived) {
        logger.error(`  - openspec/changes/${name}`);
      }
    }

    if (incompleteArchived.length > 0) {
      logger.error(
        `\x1b[31m[OpenSpec CI Error]\x1b[0m The following archived changes in 'openspec/archived/' have incomplete tasks ('- [ ]'):`,
      );
      for (const name of incompleteArchived) {
        logger.error(`  - openspec/archived/${name}/tasks.md`);
      }
    }
    return 1;
  }

  logger.log(
    '\x1b[32m[OpenSpec CI Check]\x1b[0m All OpenSpec changes are properly archived (openspec/changes/ is empty and all archived tasks are complete).',
  );
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-openspec-archived.ts')) {
  const exitCode = runCLI();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
