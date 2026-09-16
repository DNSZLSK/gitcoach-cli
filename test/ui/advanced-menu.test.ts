import type { Mocked, MockedFunction } from 'vitest';
/**
 * Behaviour tests for the real Advanced menu: submodules, worktrees and
 * commit signing. Driven through mocked prompts, asserting on the git calls
 * the menu actually makes.
 */

vi.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
}));

vi.mock('../../src/utils/logger.js', async () => (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () => (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () => (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/utils/error-mapper.js', () => ({
  mapGitError: (error: unknown) => String(error)
}));

vi.mock('../../src/utils/level-helper.js', () => ({
  shouldShowExplanation: () => false
}));

vi.mock('../../src/ui/components/prompt.js', () => ({
  promptSelect: vi.fn(),
  promptConfirm: vi.fn(),
  promptInput: vi.fn()
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getSubmodules: vi.fn(),
    initSubmodules: vi.fn(),
    updateSubmodules: vi.fn(),
    addSubmodule: vi.fn(),
    getWorktrees: vi.fn(),
    addWorktree: vi.fn(),
    removeWorktree: vi.fn(),
    getSigningConfig: vi.fn(),
    setSigningEnabled: vi.fn(),
    setSigningKey: vi.fn()
  }
}));

import { showAdvancedMenu } from '../../src/ui/menus/advanced-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';

const git = gitService as Mocked<typeof gitService>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;

const submodule = (overrides = {}) => ({
  path: 'vendor',
  commit: 'abc1234',
  initialized: true,
  modified: false,
  conflicted: false,
  ...overrides
});

const worktree = (path: string, branch: string | null) => ({
  path,
  branch,
  detached: false,
  locked: false
});

/** Answer consecutive selects, then always back out of the outer loop. */
const answers = (...values: unknown[]) => {
  values.forEach(value => select.mockResolvedValueOnce(value as never));
  select.mockResolvedValue('back' as never);
};

describe('Advanced menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    git.getSubmodules.mockResolvedValue([]);
    git.getWorktrees.mockResolvedValue([worktree('/repo', 'master')]);
    git.getSigningConfig.mockResolvedValue({ enabled: false, key: null });
    confirm.mockResolvedValue(false);
    input.mockResolvedValue('');
  });

  it('should change nothing when the user backs out immediately', async () => {
    answers('back');

    await showAdvancedMenu();

    expect(git.initSubmodules).not.toHaveBeenCalled();
    expect(git.addWorktree).not.toHaveBeenCalled();
    expect(git.setSigningEnabled).not.toHaveBeenCalled();
  });

  describe('submodules', () => {
    it('should not offer init when every submodule is already initialised', async () => {
      git.getSubmodules.mockResolvedValue([submodule()]);
      answers('submodules', '');

      await showAdvancedMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).not.toContain('init');
      expect(offered).toContain('update');
    });

    it('should offer init when a submodule is missing', async () => {
      git.getSubmodules.mockResolvedValue([submodule({ initialized: false })]);
      answers('submodules', '');

      await showAdvancedMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toContain('init');
    });

    it('should initialise submodules on request', async () => {
      git.getSubmodules.mockResolvedValue([submodule({ initialized: false })]);
      answers('submodules', 'init');

      await showAdvancedMenu();

      expect(git.initSubmodules).toHaveBeenCalled();
    });

    it('should require confirmation before updating', async () => {
      git.getSubmodules.mockResolvedValue([submodule()]);
      answers('submodules', 'update');
      confirm.mockResolvedValue(false);

      await showAdvancedMenu();

      expect(git.updateSubmodules).not.toHaveBeenCalled();
    });

    it('should update once confirmed', async () => {
      git.getSubmodules.mockResolvedValue([submodule()]);
      answers('submodules', 'update');
      confirm.mockResolvedValueOnce(true);

      await showAdvancedMenu();

      expect(git.updateSubmodules).toHaveBeenCalled();
    });

    it('should add a submodule from a url and a path', async () => {
      answers('submodules', 'add');
      input
        .mockResolvedValueOnce('https://github.com/example/lib.git')
        .mockResolvedValueOnce('vendor/lib');

      await showAdvancedMenu();

      expect(git.addSubmodule).toHaveBeenCalledWith(
        'https://github.com/example/lib.git',
        'vendor/lib'
      );
    });

    it('should abandon adding when no url is given', async () => {
      answers('submodules', 'add');
      input.mockResolvedValueOnce('');

      await showAdvancedMenu();

      expect(git.addSubmodule).not.toHaveBeenCalled();
    });
  });

  describe('worktrees', () => {
    it('should not offer removal when only the main worktree exists', async () => {
      answers('worktrees', '');

      await showAdvancedMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).not.toContain('remove');
    });

    it('should offer removal once a second worktree exists', async () => {
      git.getWorktrees.mockResolvedValue([
        worktree('/repo', 'master'),
        worktree('/repo-side', 'side')
      ]);
      answers('worktrees', '');

      await showAdvancedMenu();

      const offered = (select.mock.calls[1][1] as { value: string }[]).map(c => c.value);
      expect(offered).toContain('remove');
    });

    it('should create a worktree with a new branch when asked', async () => {
      answers('worktrees', 'add');
      input.mockResolvedValueOnce('../side').mockResolvedValueOnce('side');
      confirm.mockResolvedValueOnce(true);

      await showAdvancedMenu();

      expect(git.addWorktree).toHaveBeenCalledWith('../side', 'side', true);
    });

    it('should check out an existing branch when not creating one', async () => {
      answers('worktrees', 'add');
      input.mockResolvedValueOnce('../side').mockResolvedValueOnce('develop');
      confirm.mockResolvedValueOnce(false);

      await showAdvancedMenu();

      expect(git.addWorktree).toHaveBeenCalledWith('../side', 'develop', false);
    });

    it('should never offer the main worktree for removal', async () => {
      git.getWorktrees.mockResolvedValue([
        worktree('/repo', 'master'),
        worktree('/repo-side', 'side')
      ]);
      answers('worktrees', 'remove', '');

      await showAdvancedMenu();

      const offered = (select.mock.calls[2][1] as { value: string }[]).map(c => c.value);
      expect(offered).not.toContain('/repo');
      expect(offered).toContain('/repo-side');
    });

    it('should require confirmation before removing', async () => {
      git.getWorktrees.mockResolvedValue([
        worktree('/repo', 'master'),
        worktree('/repo-side', 'side')
      ]);
      answers('worktrees', 'remove', '/repo-side');
      confirm.mockResolvedValue(false);

      await showAdvancedMenu();

      expect(git.removeWorktree).not.toHaveBeenCalled();
    });

    it('should remove once confirmed', async () => {
      git.getWorktrees.mockResolvedValue([
        worktree('/repo', 'master'),
        worktree('/repo-side', 'side')
      ]);
      answers('worktrees', 'remove', '/repo-side');
      confirm.mockResolvedValueOnce(true);

      await showAdvancedMenu();

      expect(git.removeWorktree).toHaveBeenCalledWith('/repo-side');
    });
  });

  describe('signing', () => {
    it('should refuse to turn signing on without a key', async () => {
      git.getSigningConfig.mockResolvedValue({ enabled: false, key: null });
      answers('signing', 'on');

      await showAdvancedMenu();

      // Enabling without a key would make every later commit fail instead.
      expect(git.setSigningEnabled).not.toHaveBeenCalled();
    });

    it('should turn signing on when a key is configured', async () => {
      git.getSigningConfig.mockResolvedValue({ enabled: false, key: 'ABCD' });
      answers('signing', 'on');

      await showAdvancedMenu();

      expect(git.setSigningEnabled).toHaveBeenCalledWith(true);
    });

    it('should offer to turn signing off when it is on', async () => {
      git.getSigningConfig.mockResolvedValue({ enabled: true, key: 'ABCD' });
      answers('signing', 'off');

      await showAdvancedMenu();

      expect(git.setSigningEnabled).toHaveBeenCalledWith(false);
    });

    it('should store a signing key', async () => {
      answers('signing', 'key');
      input.mockResolvedValueOnce('KEY123');

      await showAdvancedMenu();

      expect(git.setSigningKey).toHaveBeenCalledWith('KEY123');
    });

    it('should not store an empty key', async () => {
      answers('signing', 'key');
      input.mockResolvedValueOnce('');

      await showAdvancedMenu();

      expect(git.setSigningKey).not.toHaveBeenCalled();
    });
  });
});
