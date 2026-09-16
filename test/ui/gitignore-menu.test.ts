import type { Mocked, MockedFunction } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Behaviour tests for the .gitignore menu.
 *
 * The file handling is real — a temporary directory, not a mocked fs — because
 * what this menu is judged on is what ends up in the file. Only git and the
 * prompts are replaced.
 *
 * The behaviour that matters most is the one a beginner cannot discover alone:
 * adding a tracked file to .gitignore does nothing at all. git keeps
 * committing it, and the person who added the rule has every reason to believe
 * they are safe. So the menu has to notice and offer `git rm --cached`, and
 * that is what most of these tests are about.
 */

vi.mock('../../src/i18n/index.js', async () =>
  (await import('../helpers/module-mocks.js')).i18nMock());

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () =>
  (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () =>
  (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/prompt.js', async () =>
  (await import('../helpers/module-mocks.js')).promptMock());

vi.mock('../../src/utils/error-mapper.js', async () =>
  (await import('../helpers/module-mocks.js')).errorMapperMock());

vi.mock('../../src/utils/level-helper.js', () => ({
  shouldShowExplanation: vi.fn(() => false)
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getRepoRoot: vi.fn(),
    getStatus: vi.fn(),
    isTracked: vi.fn(),
    isIgnored: vi.fn(),
    untrackKeepingFile: vi.fn()
  }
}));

import { showGitignoreMenu } from '../../src/ui/menus/gitignore-menu.js';
import { gitService } from '../../src/services/git-service.js';
import {
  promptSelect,
  promptInput,
  promptConfirm,
  promptCheckbox
} from '../../src/ui/components/prompt.js';

const git = gitService as Mocked<typeof gitService>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const input = promptInput as MockedFunction<typeof promptInput>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const checkbox = promptCheckbox as MockedFunction<typeof promptCheckbox>;

let root: string;

const write = (contents: string) => writeFileSync(join(root, '.gitignore'), contents, 'utf-8');
const read = () => readFileSync(join(root, '.gitignore'), 'utf-8');

const status = (untracked: string[] = []) => ({
  isClean: untracked.length === 0,
  current: 'main',
  tracking: 'origin/main',
  staged: [],
  modified: [],
  deleted: [],
  untracked,
  ahead: 0,
  behind: 0
});

/** Pick an entry from the top-level menu. */
const choose = (action: string) => select.mockResolvedValueOnce(action as never);

describe('Gitignore menu', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gitcoach-ignore-menu-'));
    vi.resetAllMocks();
    git.getRepoRoot.mockResolvedValue(root);
    git.getStatus.mockResolvedValue(status());
    git.isTracked.mockResolvedValue(false);
    git.isIgnored.mockResolvedValue(false);
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('');
    checkbox.mockResolvedValue([]);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('should write nothing when the user goes back', async () => {
    write('dist/\n');
    choose('back');

    const result = await showGitignoreMenu();

    expect(read()).toBe('dist/\n');
    expect(result).toEqual({ action: 'back', changed: false });
  });

  it('should not offer to view or remove when there is no .gitignore', async () => {
    choose('back');

    await showGitignoreMenu();

    const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
    expect(offered).not.toContain('view');
    expect(offered).not.toContain('remove_pattern');
    expect(offered).toContain('add_pattern');
    expect(offered).toContain('template');
  });

  it('should offer view and remove once there are patterns', async () => {
    write('dist/\n');
    choose('back');

    await showGitignoreMenu();

    const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
    expect(offered).toContain('view');
    expect(offered).toContain('remove_pattern');
  });

  it('should not offer removal when the file holds only comments', async () => {
    write('# nothing yet\n');
    choose('back');

    await showGitignoreMenu();

    const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
    expect(offered).toContain('view');
    expect(offered).not.toContain('remove_pattern');
  });

  describe('ignoring untracked files', () => {
    beforeEach(() => {
      git.getStatus.mockResolvedValue(status(['node_modules/', '.env', 'notes.txt']));
    });

    it('should add only the files the user picked', async () => {
      choose('ignore_untracked');
      checkbox.mockResolvedValue(['node_modules/', '.env']);

      const result = await showGitignoreMenu();

      expect(read()).toBe('node_modules/\n.env\n');
      expect(result.changed).toBe(true);
    });

    it('should leave every box unchecked', async () => {
      choose('ignore_untracked');

      await showGitignoreMenu();

      const offered = checkbox.mock.calls[0][1] as { checked: boolean }[];
      expect(offered.every(c => c.checked === false)).toBe(true);
    });

    it('should write nothing when no file is picked', async () => {
      choose('ignore_untracked');
      checkbox.mockResolvedValue([]);

      const result = await showGitignoreMenu();

      expect(result.changed).toBe(false);
    });

    it('should keep the existing file and append to it', async () => {
      write('# mine\ndist/\n');
      choose('ignore_untracked');
      checkbox.mockResolvedValue(['.env']);

      await showGitignoreMenu();

      expect(read()).toBe('# mine\ndist/\n.env\n');
    });

    it('should say so rather than duplicate an existing rule', async () => {
      write('.env\n');
      choose('ignore_untracked');
      checkbox.mockResolvedValue(['.env']);

      const result = await showGitignoreMenu();

      expect(read()).toBe('.env\n');
      expect(result.changed).toBe(false);
    });

    it('should not ask anything when nothing is untracked', async () => {
      git.getStatus.mockResolvedValue(status([]));
      choose('ignore_untracked');

      const result = await showGitignoreMenu();

      expect(checkbox).not.toHaveBeenCalled();
      expect(result.changed).toBe(false);
    });
  });

  describe('adding a pattern by hand', () => {
    it('should append it to the file', async () => {
      choose('add_pattern');
      input.mockResolvedValue('*.log');

      const result = await showGitignoreMenu();

      expect(read()).toBe('*.log\n');
      expect(result.changed).toBe(true);
    });

    it('should write nothing when the input is left empty', async () => {
      choose('add_pattern');
      input.mockResolvedValue('');

      const result = await showGitignoreMenu();

      expect(result.changed).toBe(false);
    });

    it('should reject an empty pattern through the prompt validator', async () => {
      choose('add_pattern');
      input.mockResolvedValue('dist/');

      await showGitignoreMenu();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('dist/')).toBe(true);
      expect(validate('   ')).not.toBe(true);
    });

    it('should say so rather than duplicate a pattern already present', async () => {
      write('*.log\n');
      choose('add_pattern');
      input.mockResolvedValue('*.log');

      const result = await showGitignoreMenu();

      expect(read()).toBe('*.log\n');
      expect(result.changed).toBe(false);
    });
  });

  describe('a pattern that matches something already tracked', () => {
    beforeEach(() => {
      git.isTracked.mockResolvedValue(true);
    });

    it('should not stay silent about it', async () => {
      choose('add_pattern');
      input.mockResolvedValue('.env');

      await showGitignoreMenu();

      expect(git.isTracked).toHaveBeenCalledWith('.env');
      expect(confirm).toHaveBeenCalledTimes(1);
    });

    it('should untrack the file while leaving it on disk, when asked', async () => {
      choose('add_pattern');
      input.mockResolvedValue('.env');

      await showGitignoreMenu();

      expect(git.untrackKeepingFile).toHaveBeenCalledWith('.env');
    });

    it('should default that question to no', async () => {
      choose('add_pattern');
      input.mockResolvedValue('.env');

      await showGitignoreMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should leave the file tracked when the user declines', async () => {
      choose('add_pattern');
      input.mockResolvedValue('.env');
      confirm.mockResolvedValue(false);

      const result = await showGitignoreMenu();

      expect(git.untrackKeepingFile).not.toHaveBeenCalled();
      // The rule was still written, which is what the user asked for.
      expect(read()).toBe('.env\n');
      expect(result.changed).toBe(true);
    });

    it('should still report the pattern as added when untracking fails', async () => {
      choose('add_pattern');
      input.mockResolvedValue('.env');
      git.untrackKeepingFile.mockRejectedValue(new Error('pathspec did not match'));

      const result = await showGitignoreMenu();

      expect(read()).toBe('.env\n');
      expect(result.changed).toBe(true);
    });

    it('should say nothing when the pattern matches nothing tracked', async () => {
      git.isTracked.mockResolvedValue(false);
      choose('add_pattern');
      input.mockResolvedValue('*.log');

      await showGitignoreMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.untrackKeepingFile).not.toHaveBeenCalled();
    });
  });

  describe('removing a pattern', () => {
    beforeEach(() => {
      write('# deps\nnode_modules/\ndist/\n');
    });

    it('should remove the chosen pattern and keep the comments', async () => {
      choose('remove_pattern');
      select.mockResolvedValue('node_modules/' as never);

      const result = await showGitignoreMenu();

      expect(read()).toBe('# deps\ndist/\n');
      expect(result.changed).toBe(true);
    });

    it('should ask first, defaulting to no', async () => {
      choose('remove_pattern');
      select.mockResolvedValue('dist/' as never);

      await showGitignoreMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should remove nothing when the confirmation is declined', async () => {
      choose('remove_pattern');
      select.mockResolvedValue('dist/' as never);
      confirm.mockResolvedValue(false);

      const result = await showGitignoreMenu();

      expect(read()).toBe('# deps\nnode_modules/\ndist/\n');
      expect(result.changed).toBe(false);
    });

    it('should offer a way out that removes nothing', async () => {
      choose('remove_pattern');
      select.mockResolvedValue('' as never);

      const result = await showGitignoreMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(read()).toBe('# deps\nnode_modules/\ndist/\n');
      expect(result.changed).toBe(false);
    });

    it('should list only real patterns, not comments', async () => {
      choose('remove_pattern');
      select.mockResolvedValue('' as never);

      await showGitignoreMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['node_modules/', 'dist/', '']);
    });
  });

  describe('writing a template', () => {
    it('should write it straight away when there is no file', async () => {
      choose('template');
      select.mockResolvedValue('node' as never);

      const result = await showGitignoreMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(read()).toContain('node_modules/');
      expect(result.changed).toBe(true);
    });

    it('should ask before replacing an existing file, defaulting to no', async () => {
      write('# mine\ndist/\n');
      choose('template');
      select.mockResolvedValue('node' as never);

      await showGitignoreMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
    });

    it('should keep the existing file when the user declines', async () => {
      write('# mine\ndist/\n');
      choose('template');
      select.mockResolvedValue('node' as never);
      confirm.mockResolvedValue(false);

      const result = await showGitignoreMenu();

      expect(read()).toBe('# mine\ndist/\n');
      expect(result.changed).toBe(false);
    });

    it('should offer a way out that writes nothing', async () => {
      choose('template');
      select.mockResolvedValue('' as never);

      const result = await showGitignoreMenu();

      expect(result.changed).toBe(false);
    });
  });

  describe('checking a path', () => {
    it('should ask git rather than guess from the file', async () => {
      choose('check');
      input.mockResolvedValue('dist/app.js');
      git.isIgnored.mockResolvedValue(true);

      const result = await showGitignoreMenu();

      expect(git.isIgnored).toHaveBeenCalledWith('dist/app.js');
      expect(result.changed).toBe(false);
    });

    it('should not call git when the input is left empty', async () => {
      choose('check');
      input.mockResolvedValue('');

      await showGitignoreMenu();

      expect(git.isIgnored).not.toHaveBeenCalled();
    });
  });

  it('should report the failure rather than throw when git is unavailable', async () => {
    git.getRepoRoot.mockRejectedValue(new Error('not a git repository'));

    const result = await showGitignoreMenu();

    expect(result).toEqual({ action: 'back', changed: false });
  });
});
