import type { Mocked, MockedFunction } from 'vitest';

/**
 * Behaviour tests for the real push menu.
 *
 * The push menu exists to stop two specific mistakes: a push that silently
 * overwrites a remote that has moved on, and a `--force` that goes out because
 * someone pressed enter twice. So these tests are written around what must
 * *not* happen. Asserting that a mock recorded its own call proves nothing;
 * what matters is that declining either force-push confirmation leaves the
 * remote untouched, and that the ordinary path never passes force: true.
 *
 * The menu is imported for real and driven through mocked prompts.
 */

vi.mock('../../src/i18n/index.js', async () =>
  (await import('../helpers/module-mocks.js')).i18nMock());

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () =>
  (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () =>
  (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/spinner.js', async () =>
  (await import('../helpers/module-mocks.js')).spinnerMock());

vi.mock('../../src/ui/components/prompt.js', async () =>
  (await import('../helpers/module-mocks.js')).promptMock());

vi.mock('../../src/utils/error-mapper.js', async () =>
  (await import('../helpers/module-mocks.js')).errorMapperMock());

vi.mock('../../src/utils/level-helper.js', () => ({
  shouldConfirm: vi.fn(() => true),
  shouldShowWarning: vi.fn(() => true),
  shouldShowExplanation: vi.fn(() => false)
}));

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    hasRemote: vi.fn(),
    addRemote: vi.fn(),
    getStatus: vi.fn(),
    hasUnpushedCommits: vi.fn(),
    getUnpushedCommitCount: vi.fn(),
    push: vi.fn(),
    pull: vi.fn()
  }
}));

vi.mock('../../src/services/prevention-service.js', () => ({
  preventionService: {
    validatePush: vi.fn(),
    checkForcePush: vi.fn()
  }
}));

vi.mock('../../src/config/user-config.js', () => ({
  userConfig: { incrementErrorsPrevented: vi.fn() }
}));

import { showPushMenu, showForcePushMenu } from '../../src/ui/menus/push-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { preventionService } from '../../src/services/prevention-service.js';
import { userConfig } from '../../src/config/user-config.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';
import { shouldConfirm } from '../../src/utils/level-helper.js';

const git = gitService as Mocked<typeof gitService>;
const prevention = preventionService as Mocked<typeof preventionService>;
const config = userConfig as Mocked<typeof userConfig>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;
const confirmsAtLevel = shouldConfirm as MockedFunction<typeof shouldConfirm>;

const status = (overrides: Record<string, unknown> = {}) => ({
  isClean: true,
  current: 'feature',
  tracking: 'origin/feature',
  staged: [],
  modified: [],
  deleted: [],
  untracked: [],
  ahead: 1,
  behind: 0,
  ...overrides
});

/** Argument positions of `push(remote, branch, force, setUpstream)`. */
const FORCE = 2;
const SET_UPSTREAM = 3;

describe('Push menu', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: clear wipes recorded calls but leaves
    // implementations in place, so one test's mockRejectedValue leaks into the
    // next. Every default this suite needs is re-established below.
    vi.resetAllMocks();
    confirmsAtLevel.mockReturnValue(true);
    git.hasRemote.mockResolvedValue(true);
    git.getStatus.mockResolvedValue(status());
    git.hasUnpushedCommits.mockResolvedValue(true);
    git.getUnpushedCommitCount.mockResolvedValue(1);
    prevention.validatePush.mockResolvedValue({ valid: true, warnings: [], canProceed: true });
    prevention.checkForcePush.mockResolvedValue(null);
    confirm.mockResolvedValue(true);
    input.mockResolvedValue('');
  });

  describe('the ordinary push', () => {
    it('should push the current branch without forcing', async () => {
      const result = await showPushMenu();

      expect(git.push).toHaveBeenCalledTimes(1);
      expect(git.push.mock.calls[0][FORCE]).toBe(false);
      expect(result).toEqual({ pushed: true, remote: 'origin', branch: 'feature' });
    });

    it('should not push when the user declines the confirmation', async () => {
      confirm.mockResolvedValue(false);

      const result = await showPushMenu();

      expect(git.push).not.toHaveBeenCalled();
      expect(result.pushed).toBe(false);
    });

    it('should not ask an expert to confirm a non-destructive push', async () => {
      confirmsAtLevel.mockReturnValue(false);

      await showPushMenu();

      expect(confirm).not.toHaveBeenCalled();
      expect(git.push).toHaveBeenCalledTimes(1);
    });

    it('should set the upstream on a first push', async () => {
      git.getStatus.mockResolvedValue(status({ tracking: null }));

      await showPushMenu();

      expect(git.push.mock.calls[0][SET_UPSTREAM]).toBe(true);
    });

    it('should not set the upstream again once the branch tracks one', async () => {
      await showPushMenu();

      expect(git.push.mock.calls[0][SET_UPSTREAM]).toBe(false);
    });

    it('should do nothing when there is nothing to push', async () => {
      git.hasUnpushedCommits.mockResolvedValue(false);

      const result = await showPushMenu();

      expect(git.push).not.toHaveBeenCalled();
      expect(result.pushed).toBe(false);
    });

    it('should report failure rather than throw when git refuses the push', async () => {
      git.push.mockRejectedValue(new Error('rejected: non-fast-forward'));

      const result = await showPushMenu();

      expect(result.pushed).toBe(false);
    });
  });

  describe('when the remote has moved on', () => {
    beforeEach(() => {
      git.getStatus.mockResolvedValue(status({ behind: 3 }));
    });

    it('should not push behind the back of the user, but ask what to do', async () => {
      select.mockResolvedValue('cancel' as never);

      const result = await showPushMenu();

      expect(select).toHaveBeenCalledTimes(1);
      expect(git.push).not.toHaveBeenCalled();
      expect(git.pull).not.toHaveBeenCalled();
      expect(result.pushed).toBe(false);
    });

    it('should offer the safe option before the dangerous one', async () => {
      select.mockResolvedValue('cancel' as never);

      await showPushMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['pull_then_push', 'force', 'cancel']);
    });

    it('should pull before pushing when asked to', async () => {
      select.mockResolvedValue('pull_then_push' as never);
      git.getStatus
        .mockResolvedValueOnce(status({ behind: 3 }))
        .mockResolvedValue(status({ behind: 0 }));

      await showPushMenu();

      expect(git.pull).toHaveBeenCalledWith('origin', 'feature');
      expect(git.pull.mock.invocationCallOrder[0]).toBeLessThan(
        git.push.mock.invocationCallOrder[0]
      );
      expect(git.push.mock.calls[0][FORCE]).toBe(false);
    });
  });

  describe('force push', () => {
    it('should require two confirmations before overwriting the remote', async () => {
      await showForcePushMenu();

      expect(confirm).toHaveBeenCalledTimes(2);
      expect(git.push).toHaveBeenCalledTimes(1);
      expect(git.push.mock.calls[0][FORCE]).toBe(true);
    });

    it('should default both confirmations to no', async () => {
      await showForcePushMenu();

      expect(confirm.mock.calls[0][1]).toBe(false);
      expect(confirm.mock.calls[1][1]).toBe(false);
    });

    it('should stop at the first refusal and count it as a mistake prevented', async () => {
      confirm.mockResolvedValueOnce(false);

      const result = await showForcePushMenu();

      expect(confirm).toHaveBeenCalledTimes(1);
      expect(git.push).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.pushed).toBe(false);
    });

    it('should stop at the second refusal, having asked twice', async () => {
      confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const result = await showForcePushMenu();

      expect(confirm).toHaveBeenCalledTimes(2);
      expect(git.push).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.pushed).toBe(false);
    });

    it('should report failure rather than throw when the force push is rejected', async () => {
      git.push.mockRejectedValue(new Error('remote rejected'));

      const result = await showForcePushMenu();

      expect(result.pushed).toBe(false);
    });

    it('should reach the force menu from the behind-remote choice, not push directly', async () => {
      git.getStatus.mockResolvedValue(status({ behind: 3 }));
      select.mockResolvedValue('force' as never);
      confirm.mockResolvedValueOnce(false);

      const result = await showPushMenu();

      expect(git.push).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.pushed).toBe(false);
    });
  });

  describe('when prevention blocks the push', () => {
    it('should not push and should count a mistake prevented', async () => {
      prevention.validatePush.mockResolvedValue({
        valid: false,
        canProceed: false,
        warnings: [
          { level: 'critical', title: 'warnings.title', message: 'protected branch', action: 'stop' }
        ]
      });

      const result = await showPushMenu();

      expect(git.push).not.toHaveBeenCalled();
      expect(config.incrementErrorsPrevented).toHaveBeenCalledTimes(1);
      expect(result.pushed).toBe(false);
    });

    it('should let a non-blocking warning through', async () => {
      prevention.validatePush.mockResolvedValue({
        valid: false,
        canProceed: true,
        warnings: [
          { level: 'warning', title: 'warnings.title', message: 'unusual branch', action: 'check' }
        ]
      });

      const result = await showPushMenu();

      expect(git.push).toHaveBeenCalledTimes(1);
      expect(config.incrementErrorsPrevented).not.toHaveBeenCalled();
      expect(result.pushed).toBe(true);
    });
  });

  describe('when no remote is configured', () => {
    beforeEach(() => {
      git.hasRemote.mockResolvedValue(false);
    });

    it('should leave the repository alone when the user declines to add one', async () => {
      confirm.mockResolvedValueOnce(false);

      const result = await showPushMenu();

      expect(git.addRemote).not.toHaveBeenCalled();
      expect(git.push).not.toHaveBeenCalled();
      expect(result.pushed).toBe(false);
    });

    it('should add the remote the user gives, then push to it', async () => {
      input.mockResolvedValueOnce('https://github.com/user/repo.git');

      const result = await showPushMenu();

      expect(git.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/user/repo.git');
      expect(result.pushed).toBe(true);
    });

    it('should not add a remote when the url is left empty', async () => {
      input.mockResolvedValueOnce('');

      const result = await showPushMenu();

      expect(git.addRemote).not.toHaveBeenCalled();
      expect(result.pushed).toBe(false);
    });

    it('should reject an invalid url through the prompt validator', async () => {
      input.mockResolvedValueOnce('https://github.com/user/repo.git');

      await showPushMenu();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('not a url')).not.toBe(true);
      expect(validate('   ')).not.toBe(true);
      expect(validate('https://github.com/user/repo.git')).toBe(true);
    });
  });
});
