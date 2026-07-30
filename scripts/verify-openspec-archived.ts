import fs from 'node:fs';
import path from 'node:path';

export function checkUnarchivedChanges(rootDir: string = process.cwd()): {
  unarchived: string[];
  incompleteArchived: string[];
  invalidNameArchived: string[];
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

  const archiveDir = path.join(rootDir, 'openspec', 'changes', 'archive');
  const incompleteArchived: string[] = [];
  const invalidNameArchived: string[] = [];

  if (fs.existsSync(archiveDir)) {
    const archivedEntries = fs.readdirSync(archiveDir, { withFileTypes: true });
    for (const entry of archivedEntries) {
      if (entry.name.startsWith('.')) continue;
      const entryPath = path.join(archiveDir, entry.name);
      if (entry.isDirectory()) {
        // Enforce YYYY-MM-DD-name date prefix format
        if (!/^\d{4}-\d{2}-\d{2}-/.test(entry.name)) {
          invalidNameArchived.push(entry.name);
        }
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
    invalidNameArchived,
    ok:
      unarchived.length === 0 &&
      incompleteArchived.length === 0 &&
      invalidNameArchived.length === 0,
  };
}

export function runCLI(
  rootDir: string = process.cwd(),
  logger: { error: typeof console.error; log: typeof console.log } = console,
): number {
  const { unarchived, incompleteArchived, invalidNameArchived, ok } =
    checkUnarchivedChanges(rootDir);

  if (!ok) {
    if (unarchived.length > 0) {
      logger.error(
        `\x1b[31m[OpenSpec CI Error]\x1b[0m OpenSpec changes directory MUST be empty. The following items in 'openspec/changes/' must be moved to 'openspec/changes/archive/YYYY-MM-DD-name/':`,
      );
      for (const name of unarchived) {
        logger.error(`  - openspec/changes/${name}`);
      }
    }

    if (invalidNameArchived && invalidNameArchived.length > 0) {
      logger.error(
        `\x1b[31m[OpenSpec CI Error]\x1b[0m The following archived changes in 'openspec/changes/archive/' lack the required 'YYYY-MM-DD-' date prefix:`,
      );
      for (const name of invalidNameArchived) {
        logger.error(`  - openspec/changes/archive/${name}`);
      }
    }

    if (incompleteArchived.length > 0) {
      logger.error(
        `\x1b[31m[OpenSpec CI Error]\x1b[0m The following archived changes in 'openspec/changes/archive/' have incomplete tasks ('- [ ]'):`,
      );
      for (const name of incompleteArchived) {
        logger.error(`  - openspec/changes/archive/${name}/tasks.md`);
      }
    }
    return 1;
  }

  logger.log(
    '\x1b[32m[OpenSpec CI Check]\x1b[0m All OpenSpec changes are properly archived in openspec/changes/archive/YYYY-MM-DD-name/.',
  );
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('verify-openspec-archived.ts')) {
  const exitCode = runCLI();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
