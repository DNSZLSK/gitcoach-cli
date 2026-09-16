import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real stash menu.
 *
 * Replaces test/integration/stash.test.ts, which called
 * `mockGitService.stash()` and then asserted that `mockGitService.stash` had
 * been called. Twenty-seven tests, no production line executed.
 *
 * What is worth checking here is the difference between the operations, since
 * that is what a user gets wrong: apply keeps the stash and pop consumes it,
 * drop throws work away and is the only one that asks first. And every entry
 * has to cope with there being no stashes at all, which is the state the menu
 * is most often opened in.
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
    hasUncommittedChanges: vi.fn(),
    stash: vi.fn(),
    getStashList: vi.fn(),
    stashApply: vi.fn(),
    stashPop: vi.fn(),
    stashDrop: vi.fn()
  }
}));

import { showStashMenu } from '../../src/ui/menus/stash-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';

const git = gitService as Mocked<typeof gitService>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;

/**
 * Pick one entry, then leave. The menu loops until "back", so every test has
 * to queue the exit or it never returns.
 */
const choose = (action: string) => {
  select.mockResolvedValueOnce(action as never);
  select.mockResolvedValue('back' as never);
};

/** Pick an entry, then answer the second prompt, then leave. */
const chooseThen = (action: string, answer: unknown) => {
  select.mockResolvedValueOnce(action as never);
  select.mockResolvedValueOnce(answer as never);
  select.mockResolvedValue('back' as never);
};

describe('Stash menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    git.hasUncommittedChanges.mockResolvedValue(true);
    git.getStashList.mockResolvedValue(['WIP on main: abc1234 something', 'On main: an older one']);
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('');
  });

  it('should touch nothing when the user leaves straight away', async () => {
    select.mockResolvedValue('back' as never);

    await showStashMenu();

    expect(git.stash).not.toHaveBeenCalled();
    expect(git.stashApply).not.toHaveBeenCalled();
    expect(git.stashPop).not.toHaveBeenCalled();
    expect(git.stashDrop).not.toHaveBeenCalled();
  });

  it('should mark the separator as unselectable', async () => {
    select.mockResolvedValue('back' as never);

    await showStashMenu();

    const choices = select.mock.calls[0][1] as { value: string; disabled?: boolean }[];
    expect(choices.find(c => c.value === 'separator')?.disabled).toBe(true);
  });

  it('should keep offering the menu until the user backs out', async () => {
    select
      .mockResolvedValueOnce('list' as never)
      .mockResolvedValueOnce('list' as never)
      .mockResolvedValue('back' as never);

    await showStashMenu();

    expect(select).toHaveBeenCalledTimes(3);
  });

  describe('saving', () => {
    it('should stash without a message when none is typed', async () => {
      choose('save');
      input.mockResolvedValue('');

      await showStashMenu();

      expect(git.stash).toHaveBeenCalledWith();
    });

    it('should pass the message when one is typed', async () => {
      choose('save');
      input.mockResolvedValue('half-finished login form');

      await showStashMenu();

      expect(git.stash).toHaveBeenCalledWith('half-finished login form');
    });

    it('should trim the message rather than store the spaces', async () => {
      choose('save');
      input.mockResolvedValue('  padded  ');

      await showStashMenu();

      expect(git.stash).toHaveBeenCalledWith('padded');
    });

    it('should treat a message of only spaces as no message', async () => {
      choose('save');
      input.mockResolvedValue('   ');

      await showStashMenu();

      expect(git.stash).toHaveBeenCalledWith();
    });

    it('should not stash, or ask, when there is nothing to stash', async () => {
      choose('save');
      git.hasUncommittedChanges.mockResolvedValue(false);

      await showStashMenu();

      expect(input).not.toHaveBeenCalled();
      expect(git.stash).not.toHaveBeenCalled();
    });

    it('should report the error rather than throw when the stash fails', async () => {
      choose('save');
      git.stash.mockRejectedValue(new Error('cannot stash'));

      await expect(showStashMenu()).resolves.toBeUndefined();
    });
  });

  describe('applying', () => {
    it('should apply the stash the user picked', async () => {
      chooseThen('apply', 1);

      await showStashMenu();

      expect(git.stashApply).toHaveBeenCalledWith(1);
      // apply keeps the stash; that is the whole difference from pop.
      expect(git.stashDrop).not.toHaveBeenCalled();
    });

    it('should offer every stash by its index', async () => {
      chooseThen('apply', 0);

      await showStashMenu();

      const offered = (select.mock.calls[1][1] as { value: number }[]).map(c => c.value);
      expect(offered).toEqual([0, 1]);
    });

    it('should not ask which one when there are none', async () => {
      choose('apply');
      git.getStashList.mockResolvedValue([]);

      await showStashMenu();

      expect(select).toHaveBeenCalledTimes(2);
      expect(git.stashApply).not.toHaveBeenCalled();
    });

    it('should report the error rather than throw when applying fails', async () => {
      chooseThen('apply', 0);
      git.stashApply.mockRejectedValue(new Error('conflict while applying'));

      await expect(showStashMenu()).resolves.toBeUndefined();
    });
  });

  describe('popping', () => {
    it('should pop the most recent stash without asking which', async () => {
      choose('pop');

      await showStashMenu();

      expect(git.stashPop).toHaveBeenCalledTimes(1);
      expect(select).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when there is no stash', async () => {
      choose('pop');
      git.getStashList.mockResolvedValue([]);

      await showStashMenu();

      expect(git.stashPop).not.toHaveBeenCalled();
    });

    it('should report the error rather than throw when popping fails', async () => {
      choose('pop');
      git.stashPop.mockRejectedValue(new Error('conflict while popping'));

      await expect(showStashMenu()).resolves.toBeUndefined();
    });
  });

  describe('dropping', () => {
    it('should confirm before throwing work away, defaulting to no', async () => {
      chooseThen('drop', 0);

      await showStashMenu();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(git.stashDrop).toHaveBeenCalledWith(0);
    });

    it('should drop nothing when the confirmation is declined', async () => {
      chooseThen('drop', 1);
      confirm.mockResolvedValue(false);

      await showStashMenu();

      expect(git.stashDrop).not.toHaveBeenCalled();
    });

    it('should drop the stash the user picked, not the first one', async () => {
      chooseThen('drop', 1);

      await showStashMenu();

      expect(git.stashDrop).toHaveBeenCalledWith(1);
    });

    it('should not ask anything when there is nothing to drop', async () => {
      choose('drop');
      git.getStashList.mockResolvedValue([]);

      await showStashMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.stashDrop).not.toHaveBeenCalled();
    });

    it('should report the error rather than throw when dropping fails', async () => {
      chooseThen('drop', 0);
      git.stashDrop.mockRejectedValue(new Error('no such stash'));

      await expect(showStashMenu()).resolves.toBeUndefined();
    });
  });

  describe('listing', () => {
    it('should read the stashes without changing anything', async () => {
      choose('list');

      await showStashMenu();

      expect(git.getStashList).toHaveBeenCalled();
      expect(git.stashApply).not.toHaveBeenCalled();
      expect(git.stashDrop).not.toHaveBeenCalled();
    });

    it('should cope with an empty list', async () => {
      choose('list');
      git.getStashList.mockResolvedValue([]);

      await expect(showStashMenu()).resolves.toBeUndefined();
    });
  });

  it('should treat a failure to read the stash list as an empty list', async () => {
    // getStashList is wrapped so a git failure does not take the menu down
    // with it; the user gets "no stashes" rather than a stack trace.
    choose('apply');
    git.getStashList.mockRejectedValue(new Error('not a git repository'));

    await expect(showStashMenu()).resolves.toBeUndefined();
    expect(git.stashApply).not.toHaveBeenCalled();
  });
});
