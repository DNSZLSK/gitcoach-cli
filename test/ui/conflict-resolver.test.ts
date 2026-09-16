import type { Mocked, MockedFunction } from 'vitest';
/**
 * Behaviour tests for the guided conflict resolver.
 *
 * This is one of the tool's flagship features and it had no behavioural test at
 * all: only the pure parsing helpers around it were covered. These drive the
 * real menu over a temporary file containing genuine conflict markers, and
 * assert on what ends up written to disk and staged.
 */

vi.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
}));

vi.mock('../../src/utils/logger.js', async () => (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () => (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () => (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/spinner.js', async () => (await import('../helpers/module-mocks.js')).spinnerMock());

vi.mock('../../src/utils/error-mapper.js', () => ({
  mapGitError: (error: unknown) => String(error)
}));

vi.mock('../../src/ui/components/prompt.js', () => ({
  promptSelect: vi.fn(),
  promptConfirm: vi.fn(),
  promptInput: vi.fn()
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getConflictedFiles: vi.fn(),
    add: vi.fn(),
    commitNoEdit: vi.fn()
  }
}));

vi.mock('../../src/services/ai/index.js', () => ({
  aiService: {
    isAvailable: vi.fn(),
    suggestConflictResolution: vi.fn()
  }
}));

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { showConflictResolutionMenu } from '../../src/ui/menus/conflict-resolution-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { aiService } from '../../src/services/ai/index.js';
import { promptSelect, promptConfirm } from '../../src/ui/components/prompt.js';

const git = gitService as Mocked<typeof gitService>;
const ai = aiService as Mocked<typeof aiService>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;

const conflict = (local: string, remote: string) =>
  `<<<<<<< HEAD\n${local}\n=======\n${remote}\n>>>>>>> branch\n`;

describe('Guided conflict resolver', () => {
  let dir: string;
  let file: string;

  const writeConflicted = (content: string) => {
    writeFileSync(file, content, 'utf-8');
    git.getConflictedFiles.mockResolvedValue([file]);
  };

  const read = () => readFileSync(file, 'utf-8');

  beforeEach(() => {
    vi.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), 'gitcoach-conflict-'));
    file = join(dir, 'conflicted.txt');
    ai.isAvailable.mockResolvedValue(false);
    confirm.mockResolvedValue(false);
    git.commitNoEdit.mockResolvedValue('abc1234');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should report resolved when there is nothing to resolve', async () => {
    git.getConflictedFiles.mockResolvedValue([]);

    await expect(showConflictResolutionMenu()).resolves.toEqual({ resolved: true });
  });

  it('should keep the local side and stage the file', async () => {
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('local' as never);

    const result = await showConflictResolutionMenu();

    expect(read()).toContain('mine');
    expect(read()).not.toContain('theirs');
    expect(read()).not.toContain('<<<<<<<');
    expect(git.add).toHaveBeenCalledWith(file);
    expect(result.resolved).toBe(true);
  });

  it('should keep the remote side', async () => {
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('remote' as never);

    await showConflictResolutionMenu();

    expect(read()).toContain('theirs');
    expect(read()).not.toContain('mine');
  });

  it('should keep both sides', async () => {
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('both' as never);

    await showConflictResolutionMenu();

    const content = read();
    expect(content.indexOf('mine')).toBeLessThan(content.indexOf('theirs'));
  });

  it('should resolve every block in a file with several conflicts', async () => {
    writeConflicted(conflict('a', 'b') + 'middle\n' + conflict('c', 'd'));
    select.mockResolvedValue('local' as never);

    await showConflictResolutionMenu();

    const content = read();
    expect(content).toContain('a');
    expect(content).toContain('middle');
    expect(content).toContain('c');
    expect(content).not.toContain('<<<<<<<');
  });

  it('should preserve the text around the conflict', async () => {
    writeConflicted('header\n' + conflict('mine', 'theirs') + 'footer\n');
    select.mockResolvedValue('local' as never);

    await showConflictResolutionMenu();

    expect(read()).toContain('header');
    expect(read()).toContain('footer');
  });

  it('should stage a file that no longer has markers without asking', async () => {
    // Someone resolved it in their editor before coming back to the tool.
    writeConflicted('already resolved\n');

    const result = await showConflictResolutionMenu();

    expect(git.add).toHaveBeenCalledWith(file);
    expect(select).not.toHaveBeenCalled();
    expect(result.resolved).toBe(true);
  });

  it('should not stage a file the user backed out of', async () => {
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('back' as never);

    const result = await showConflictResolutionMenu();

    expect(git.add).not.toHaveBeenCalled();
    expect(read()).toContain('<<<<<<<');
    expect(result.resolved).toBe(false);
  });

  it('should report partial progress across several files', async () => {
    const second = join(dir, 'second.txt');
    writeFileSync(file, conflict('mine', 'theirs'), 'utf-8');
    writeFileSync(second, conflict('x', 'y'), 'utf-8');
    git.getConflictedFiles.mockResolvedValue([file, second]);
    // Resolve the first, back out of the second.
    select.mockResolvedValueOnce('local' as never).mockResolvedValue('back' as never);

    const result = await showConflictResolutionMenu();

    expect(result.resolved).toBe(false);
    expect(git.add).toHaveBeenCalledTimes(1);
  });

  it('should survive a file it cannot read', async () => {
    git.getConflictedFiles.mockResolvedValue([join(dir, 'missing.txt')]);

    const result = await showConflictResolutionMenu();

    expect(result.resolved).toBe(false);
    expect(git.add).not.toHaveBeenCalled();
  });

  it('should offer the merge commit once everything is resolved', async () => {
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('local' as never);
    confirm.mockResolvedValue(true);

    await showConflictResolutionMenu();

    expect(git.commitNoEdit).toHaveBeenCalled();
  });

  it('should not commit when the user declines', async () => {
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('local' as never);
    confirm.mockResolvedValue(false);

    const result = await showConflictResolutionMenu();

    expect(git.commitNoEdit).not.toHaveBeenCalled();
    expect(result.resolved).toBe(true);
  });

  it('should still report resolved when the merge commit fails', async () => {
    // The files are resolved either way; a failed commit must not undo that.
    writeConflicted(conflict('mine', 'theirs'));
    select.mockResolvedValue('local' as never);
    confirm.mockResolvedValue(true);
    git.commitNoEdit.mockRejectedValue(new Error('nothing to commit'));

    const result = await showConflictResolutionMenu();

    expect(result.resolved).toBe(true);
  });

  describe('with an AI provider available', () => {
    beforeEach(() => {
      ai.isAvailable.mockResolvedValue(true);
    });

    it('should offer the AI option only when a provider is available', async () => {
      writeConflicted(conflict('mine', 'theirs'));
      select.mockResolvedValue('back' as never);

      await showConflictResolutionMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toContain('copilot');
    });

    it('should apply an accepted AI recommendation', async () => {
      writeConflicted(conflict('mine', 'theirs'));
      select.mockResolvedValue('copilot' as never);
      ai.suggestConflictResolution.mockResolvedValue({
        recommendation: 'remote',
        explanation: 'The remote version is newer.'
      });
      confirm.mockResolvedValue(true);

      await showConflictResolutionMenu();

      expect(read()).toContain('theirs');
      expect(read()).not.toContain('<<<<<<<');
    });

    it('should write custom content when the AI proposes it', async () => {
      writeConflicted(conflict('mine', 'theirs'));
      select.mockResolvedValue('copilot' as never);
      ai.suggestConflictResolution.mockResolvedValue({
        recommendation: 'custom',
        explanation: 'Combine both behaviours.',
        customContent: 'merged result'
      });
      confirm.mockResolvedValue(true);

      await showConflictResolutionMenu();

      expect(read()).toContain('merged result');
    });

    it('should leave the file untouched when the AI cannot answer', async () => {
      writeConflicted(conflict('mine', 'theirs'));
      // Ask the AI once, then back out rather than looping forever.
      select.mockResolvedValueOnce('copilot' as never).mockResolvedValue('back' as never);
      ai.suggestConflictResolution.mockResolvedValue(null);

      await showConflictResolutionMenu();

      expect(read()).toContain('<<<<<<<');
      expect(git.add).not.toHaveBeenCalled();
    });
  });
});
