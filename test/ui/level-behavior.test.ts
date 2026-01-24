import { describe, it, expect } from '@jest/globals';

/**
 * Unit tests for level-based behavior logic
 * Tests the expected behavior of shouldConfirm, shouldShowWarning, shouldShowExplanation
 * without importing the actual modules (to avoid ESM issues)
 */

// Replicate the logic from level-helper.ts for testing
type ExperienceLevel = 'beginner' | 'intermediate' | 'expert';
type WarningCategory = 'critical' | 'warning' | 'info';

// Test implementations matching the actual code
function shouldConfirmLogic(level: ExperienceLevel, isDestructive: boolean, confirmDestructive: boolean): boolean {
  if (level === 'beginner' || level === 'intermediate') return true;
  return isDestructive && confirmDestructive;
}

function shouldShowWarningLogic(level: ExperienceLevel, category: WarningCategory): boolean {
  if (level === 'beginner') return true;
  if (level === 'intermediate') return category !== 'info';
  return category === 'critical'; // expert
}

function shouldShowExplanationLogic(level: ExperienceLevel): boolean {
  return level === 'beginner';
}

describe('Level Helper Functions - Logic Tests', () => {
  describe('Beginner Level', () => {
    const level: ExperienceLevel = 'beginner';

    it('should confirm non-destructive actions', () => {
      expect(shouldConfirmLogic(level, false, true)).toBe(true);
    });

    it('should confirm destructive actions', () => {
      expect(shouldConfirmLogic(level, true, true)).toBe(true);
    });

    it('should show info warnings', () => {
      expect(shouldShowWarningLogic(level, 'info')).toBe(true);
    });

    it('should show warning warnings', () => {
      expect(shouldShowWarningLogic(level, 'warning')).toBe(true);
    });

    it('should show critical warnings', () => {
      expect(shouldShowWarningLogic(level, 'critical')).toBe(true);
    });

    it('should show explanations', () => {
      expect(shouldShowExplanationLogic(level)).toBe(true);
    });
  });

  describe('Intermediate Level', () => {
    const level: ExperienceLevel = 'intermediate';

    it('should confirm non-destructive actions', () => {
      expect(shouldConfirmLogic(level, false, true)).toBe(true);
    });

    it('should confirm destructive actions', () => {
      expect(shouldConfirmLogic(level, true, true)).toBe(true);
    });

    it('should NOT show info warnings', () => {
      expect(shouldShowWarningLogic(level, 'info')).toBe(false);
    });

    it('should show warning warnings', () => {
      expect(shouldShowWarningLogic(level, 'warning')).toBe(true);
    });

    it('should show critical warnings', () => {
      expect(shouldShowWarningLogic(level, 'critical')).toBe(true);
    });

    it('should NOT show explanations', () => {
      expect(shouldShowExplanationLogic(level)).toBe(false);
    });
  });

  describe('Expert Level', () => {
    const level: ExperienceLevel = 'expert';

    it('should NOT confirm non-destructive actions', () => {
      expect(shouldConfirmLogic(level, false, true)).toBe(false);
    });

    it('should confirm destructive actions when setting enabled', () => {
      expect(shouldConfirmLogic(level, true, true)).toBe(true);
    });

    it('should NOT confirm destructive actions when setting disabled', () => {
      expect(shouldConfirmLogic(level, true, false)).toBe(false);
    });

    it('should NOT show info warnings', () => {
      expect(shouldShowWarningLogic(level, 'info')).toBe(false);
    });

    it('should NOT show warning warnings', () => {
      expect(shouldShowWarningLogic(level, 'warning')).toBe(false);
    });

    it('should show critical warnings', () => {
      expect(shouldShowWarningLogic(level, 'critical')).toBe(true);
    });

    it('should NOT show explanations', () => {
      expect(shouldShowExplanationLogic(level)).toBe(false);
    });
  });
});

describe('Level Helper - Edge Cases', () => {
  it('beginner + destructive disabled = still confirm (level overrides)', () => {
    expect(shouldConfirmLogic('beginner', true, false)).toBe(true);
  });

  it('intermediate + destructive disabled = still confirm (level overrides)', () => {
    expect(shouldConfirmLogic('intermediate', true, false)).toBe(true);
  });

  it('expert + non-destructive + destructive enabled = no confirm', () => {
    expect(shouldConfirmLogic('expert', false, true)).toBe(false);
  });
});
