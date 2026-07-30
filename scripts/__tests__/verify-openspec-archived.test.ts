import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkUnarchivedChanges, runCLI } from '../verify-openspec-archived';

describe('checkUnarchivedChanges', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openspec-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return ok: true when openspec/changes does not exist', () => {
    const result = checkUnarchivedChanges(tempDir);
    expect(result.ok).toBe(true);
    expect(result.unarchived).toHaveLength(0);
  });

  it("should return ok: false when changes have pending tasks", () => {
    const changeDir = path.join(tempDir, "openspec", "changes", "feature-a");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "- [x] Done\n- [ ] Pending");

    const result = checkUnarchivedChanges(tempDir);
    expect(result.ok).toBe(false);
    expect(result.unarchived).toEqual(["feature-a"]);
  });

  it("should return ok: false and list change when all tasks are checked", () => {
    const changeDir = path.join(tempDir, "openspec", "changes", "completed-feature");
    fs.mkdirSync(changeDir, { recursive: true });
    fs.writeFileSync(path.join(changeDir, "tasks.md"), "- [x] Done task 1\n- [x] Done task 2");

    const result = checkUnarchivedChanges(tempDir);
    expect(result.ok).toBe(false);
    expect(result.unarchived).toEqual(["completed-feature"]);
  });

  it("should ignore hidden entries and archive directory inside changes/", () => {
    const hiddenDir = path.join(tempDir, "openspec", "changes", ".gitkeep");
    const archiveDir = path.join(tempDir, "openspec", "changes", "archive");
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(hiddenDir, "");
    fs.writeFileSync(path.join(archiveDir, "tasks.md"), "- [x] Done in archive");

    const result = checkUnarchivedChanges(tempDir);
    expect(result.ok).toBe(true);
    expect(result.unarchived).toHaveLength(0);
  });

  it("should return ok: false if standalone file exists in openspec/changes", () => {
    const changeFile = path.join(tempDir, "openspec", "changes", "proposal.md");
    fs.mkdirSync(path.join(tempDir, "openspec", "changes"), { recursive: true });
    fs.writeFileSync(changeFile, "# Proposal");

    const result = checkUnarchivedChanges(tempDir);
    expect(result.ok).toBe(false);
    expect(result.unarchived).toEqual(["proposal.md"]);
  });

  it("should return ok: false if an archived change has incomplete tasks", () => {
    const archiveDir = path.join(tempDir, "openspec", "archived", "incomplete-archived-change");
    fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, "tasks.md"), "- [x] Done\n- [ ] Pending task");

    const result = checkUnarchivedChanges(tempDir);
    expect(result.ok).toBe(false);
    expect(result.incompleteArchived).toEqual(["incomplete-archived-change"]);
  });

  describe('runCLI', () => {
    it('should exit code 0 when all checks pass', () => {
      const mockLogger = { error: mock(() => {}), log: mock(() => {}) };
      const code = runCLI(tempDir, mockLogger as any);
      expect(code).toBe(0);
      expect(mockLogger.log).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should exit code 1 when unarchived completed changes exist', () => {
      const changeDir = path.join(tempDir, 'openspec', 'changes', 'completed-feature');
      fs.mkdirSync(changeDir, { recursive: true });
      fs.writeFileSync(path.join(changeDir, 'tasks.md'), '- [x] Done task 1');

      const mockLogger = { error: mock(() => {}), log: mock(() => {}) };
      const code = runCLI(tempDir, mockLogger as any);
      expect(code).toBe(1);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });
  });
});
