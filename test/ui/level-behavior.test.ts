import type { Mocked } from 'vitest';

/**
 * The real level helper, driven through the real user config.
 *
 * This file used to reimplement shouldConfirm, shouldShowWarning and
 * shouldShowExplanation at the top and then assert against the copy, because
 * under Jest the module could not be imported at all. The assertions were
 * correct and proved nothing: the copy would have gone on passing while the
 * shipped code did whatever it liked.
 *
 * The questions it asks are worth keeping, though, because these three
 * functions decide how often every menu in the tool stops to ask. So the cases
 * are the same; only the target changed.
 */

vi.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    getExperienceLevel: vi.fn(),
    getConfirmDestructiveActions: vi.fn()
  }
}));

import {
  getLevel,
  isLevel,
  shouldConfirm,
  shouldShowWarning,
  shouldShowExplanation
} from '../../src/utils/level-helper.js';
import { userConfig } from '../../src/config/user-config.js';
import type { ExperienceLevel } from '../../src/config/defaults.js';

const config = userConfig as Mocked<typeof userConfig>;

const at = (level: ExperienceLevel, confirmDestructive = true) => {
  config.getExperienceLevel.mockReturnValue(level);
  config.getConfirmDestructiveActions.mockReturnValue(confirmDestructive);
};

describe('level helper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('beginner', () => {
    it('should confirm everything, destructive or not', () => {
      at('beginner');

      expect(shouldConfirm(false)).toBe(true);
      expect(shouldConfirm(true)).toBe(true);
    });

    it('should still confirm destructive actions with the preference off', () => {
      // The level wins: someone who has not turned the preference on is not
      // the person to trust with an unconfirmed reset.
      at('beginner', false);

      expect(shouldConfirm(true)).toBe(true);
    });

    it('should show warnings of every severity', () => {
      at('beginner');

      expect(shouldShowWarning('info')).toBe(true);
      expect(shouldShowWarning('warning')).toBe(true);
      expect(shouldShowWarning('critical')).toBe(true);
    });

    it('should show explanations', () => {
      at('beginner');

      expect(shouldShowExplanation()).toBe(true);
    });
  });

  describe('intermediate', () => {
    it('should confirm everything, destructive or not', () => {
      at('intermediate');

      expect(shouldConfirm(false)).toBe(true);
      expect(shouldConfirm(true)).toBe(true);
    });

    it('should still confirm destructive actions with the preference off', () => {
      at('intermediate', false);

      expect(shouldConfirm(true)).toBe(true);
    });

    it('should drop the info warnings and keep the rest', () => {
      at('intermediate');

      expect(shouldShowWarning('info')).toBe(false);
      expect(shouldShowWarning('warning')).toBe(true);
      expect(shouldShowWarning('critical')).toBe(true);
    });

    it('should not show explanations', () => {
      at('intermediate');

      expect(shouldShowExplanation()).toBe(false);
    });
  });

  describe('expert', () => {
    it('should not confirm a reversible action', () => {
      at('expert');

      expect(shouldConfirm(false)).toBe(false);
    });

    it('should confirm a destructive one while the preference is on', () => {
      at('expert', true);

      expect(shouldConfirm(true)).toBe(true);
    });

    it('should skip even that when the preference is off', () => {
      at('expert', false);

      expect(shouldConfirm(true)).toBe(false);
    });

    it('should show critical warnings only', () => {
      at('expert');

      expect(shouldShowWarning('info')).toBe(false);
      expect(shouldShowWarning('warning')).toBe(false);
      expect(shouldShowWarning('critical')).toBe(true);
    });

    it('should not show explanations', () => {
      at('expert');

      expect(shouldShowExplanation()).toBe(false);
    });
  });

  describe('reading the level', () => {
    it('should report the level the config holds', () => {
      at('expert');

      expect(getLevel()).toBe('expert');
    });

    it('should match only the level in effect', () => {
      at('intermediate');

      expect(isLevel('intermediate')).toBe(true);
      expect(isLevel('beginner')).toBe(false);
      expect(isLevel('expert')).toBe(false);
    });

    it('should read the config on every call, not once at import', () => {
      // Menus call these long after startup, and the config menu can change
      // the level mid-session. A value captured at import would go stale.
      at('beginner');
      expect(shouldShowExplanation()).toBe(true);

      at('expert');
      expect(shouldShowExplanation()).toBe(false);
    });
  });
});
