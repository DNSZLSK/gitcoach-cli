import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real history menu.
 *
 * Replaces test/integration/history.test.ts, which asserted on a mock log it
 * had just handed to itself. Fifteen tests, no production line executed.
 *
 * This menu is read-only, so there is nothing destructive to guard. What it
 * can get wrong instead is what it shows: paging, whether "view more" appears
 * when there is nothing more, and the cap on long output — a patch of ten
 * thousand lines dumped into a terminal buries the prompt and makes the tool
 * look broken, so the cap is behaviour, not decoration.
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
    getLog: vi.fn(),
    getCommitDiff: vi.fn(),
    getTrackedFiles: vi.fn(),
    blameFile: vi.fn(),
    getLocalBranches: vi.fn(),
    getDiffBetween: vi.fn()
  }
}));

import { showHistoryMenu } from '../../src/ui/menus/history-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { promptSelect } from '../../src/ui/components/prompt.js';
import { logger } from '../../src/utils/logger.js';

const git = gitService as Mocked<typeof gitService>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const log = logger as Mocked<typeof logger>;

const commit = (hash: string, message: string, date = '2026-01-01T00:00:00Z') => ({
  hash,
  message,
  author: 'Someone',
  date
});

const branch = (name: string, current = false) => ({
  name,
  current,
  commit: 'abc1234',
  label: name
});

/** A page's worth of history, plus however many extra are asked for. */
const history = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    commit(`${i}`.padStart(7, 'a'), `commit number ${i}`)
  );

/** Pick entries in order, then leave. */
const answers = (...values: unknown[]) => {
  values.forEach(value => select.mockResolvedValueOnce(value as never));
  select.mockResolvedValue('back' as never);
};

describe('History menu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    git.getLog.mockResolvedValue(history(3));
    git.getCommitDiff.mockResolvedValue('diff --git a/x b/x\n+added\n-removed');
    git.getTrackedFiles.mockResolvedValue(['src/app.ts', 'README.md']);
    git.blameFile.mockResolvedValue('abc1234 (Someone 2026-01-01 1) const x = 1;');
    git.getLocalBranches.mockResolvedValue([branch('main', true), branch('feature')]);
    git.getDiffBetween.mockResolvedValue('diff --git a/y b/y\n+one line');
  });

  it('should read the history without changing anything', async () => {
    answers('back');

    await showHistoryMenu();

    expect(git.getLog).toHaveBeenCalled();
    expect(git.getCommitDiff).not.toHaveBeenCalled();
    expect(git.blameFile).not.toHaveBeenCalled();
  });

  it('should stop immediately when there is no history at all', async () => {
    git.getLog.mockResolvedValue([]);

    await showHistoryMenu();

    expect(select).not.toHaveBeenCalled();
  });

  it('should mark the separator as unselectable', async () => {
    answers('back');

    await showHistoryMenu();

    const choices = select.mock.calls[0][1] as { value: string; disabled?: boolean }[];
    expect(choices.find(c => c.value === 'separator')?.disabled).toBe(true);
  });

  describe('paging', () => {
    it('should not offer "view more" when the page holds everything', async () => {
      git.getLog.mockResolvedValue(history(10));
      answers('back');

      await showHistoryMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).not.toContain('view_more');
    });

    it('should offer "view more" when there is an extra commit beyond the page', async () => {
      git.getLog.mockResolvedValue(history(11));
      answers('back');

      await showHistoryMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toContain('view_more');
    });

    it('should never offer more commits than fit on a page', async () => {
      git.getLog.mockResolvedValue(history(11));
      answers('back');

      await showHistoryMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      const hashes = offered.filter(v => !['separator', 'view_more', 'diff', 'blame', 'compare', 'back'].includes(v));
      expect(hashes).toHaveLength(10);
    });
  });

  describe('a commit patch', () => {
    it('should fetch the patch for the commit picked', async () => {
      answers('diff', 'aaaaaa1');

      await showHistoryMenu();

      expect(git.getCommitDiff).toHaveBeenCalledWith('aaaaaa1');
    });

    it('should offer a way out that fetches nothing', async () => {
      answers('diff', '');

      await showHistoryMenu();

      expect(git.getCommitDiff).not.toHaveBeenCalled();
    });

    it('should cope with an empty patch', async () => {
      answers('diff', 'aaaaaa1');
      git.getCommitDiff.mockResolvedValue('');

      await expect(showHistoryMenu()).resolves.toBeUndefined();
    });

    it('should cap very long output instead of flooding the terminal', async () => {
      answers('diff', 'aaaaaa1');
      git.getCommitDiff.mockResolvedValue(
        Array.from({ length: 500 }, (_, i) => `+line ${i}`).join('\n')
      );

      await showHistoryMenu();

      const printed = log.raw.mock.calls.filter(call => String(call[0]).includes('+line'));
      expect(printed).toHaveLength(200);
    });

    it('should print a short patch in full', async () => {
      answers('diff', 'aaaaaa1');
      git.getCommitDiff.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => `+line ${i}`).join('\n')
      );

      await showHistoryMenu();

      const printed = log.raw.mock.calls.filter(call => String(call[0]).includes('+line'));
      expect(printed).toHaveLength(5);
    });

    it('should report the failure rather than throw', async () => {
      answers('diff', 'aaaaaa1');
      git.getCommitDiff.mockRejectedValue(new Error('bad object'));

      await expect(showHistoryMenu()).resolves.toBeUndefined();
    });
  });

  describe('blame', () => {
    it('should blame the file picked', async () => {
      answers('blame', 'src/app.ts');

      await showHistoryMenu();

      expect(git.blameFile).toHaveBeenCalledWith('src/app.ts');
    });

    it('should offer a way out that blames nothing', async () => {
      answers('blame', '');

      await showHistoryMenu();

      expect(git.blameFile).not.toHaveBeenCalled();
    });

    it('should not ask which file when nothing is tracked', async () => {
      answers('blame');
      git.getTrackedFiles.mockResolvedValue([]);

      await showHistoryMenu();

      expect(git.blameFile).not.toHaveBeenCalled();
    });

    it('should report the failure rather than throw when the file list fails', async () => {
      answers('blame');
      git.getTrackedFiles.mockRejectedValue(new Error('not a git repository'));

      await expect(showHistoryMenu()).resolves.toBeUndefined();
      expect(git.blameFile).not.toHaveBeenCalled();
    });
  });

  describe('comparing branches', () => {
    it('should diff the two branches picked, in that order', async () => {
      answers('compare', 'main', 'feature');

      await showHistoryMenu();

      expect(git.getDiffBetween).toHaveBeenCalledWith('main', 'feature');
    });

    it('should not diff a branch against itself', async () => {
      answers('compare', 'main', 'main');

      await showHistoryMenu();

      expect(git.getDiffBetween).not.toHaveBeenCalled();
    });

    it('should need two branches before offering the comparison', async () => {
      answers('compare');
      git.getLocalBranches.mockResolvedValue([branch('main', true)]);

      await showHistoryMenu();

      expect(git.getDiffBetween).not.toHaveBeenCalled();
    });

    it('should offer a way out at either step', async () => {
      answers('compare', '');

      await showHistoryMenu();

      expect(git.getDiffBetween).not.toHaveBeenCalled();

      vi.clearAllMocks();
      git.getLog.mockResolvedValue(history(3));
      git.getLocalBranches.mockResolvedValue([branch('main', true), branch('feature')]);
      answers('compare', 'main', '');

      await showHistoryMenu();

      expect(git.getDiffBetween).not.toHaveBeenCalled();
    });
  });

  describe('commit details', () => {
    it('should look up the commit the user selected', async () => {
      answers('aaaaaa1');

      await showHistoryMenu();

      // Once for the page, once to find the commit by hash.
      expect(git.getLog.mock.calls.length).toBeGreaterThan(1);
    });

    it('should cope with a hash that is no longer in the log', async () => {
      answers('deadbeef');

      await expect(showHistoryMenu()).resolves.toBeUndefined();
    });
  });

  it('should leave the loop rather than spin when reading the log fails', async () => {
    git.getLog.mockRejectedValue(new Error('not a git repository'));

    await expect(showHistoryMenu()).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });
});
