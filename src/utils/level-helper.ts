/**
 * Level-based helper functions for adaptive UI behavior
 * based on user experience level (beginner, intermediate, expert)
 */

import { userConfig } from '../config/user-config.js';
import { ExperienceLevel } from '../config/defaults.js';

/**
 * Get the current experience level from user config
 */
export function getLevel(): ExperienceLevel {
  return userConfig.getExperienceLevel();
}

/**
 * Check if current level matches the specified level
 */
export function isLevel(level: ExperienceLevel): boolean {
  return getLevel() === level;
}

/**
 * Determine if confirmation should be shown based on level
 * - Beginner: Always confirm
 * - Intermediate: Always confirm
 * - Expert: Only confirm destructive actions
 *
 * @param isDestructive - Whether the action is destructive (force push, delete, hard reset)
 */
export function shouldConfirm(isDestructive: boolean = false): boolean {
  const level = getLevel();
  if (level === 'beginner' || level === 'intermediate') {
    return true;
  }
  // Expert: only confirm destructive actions if user preference allows
  return isDestructive && userConfig.getConfirmDestructiveActions();
}

/**
 * Warning severity categories
 * - critical: Data loss, force push, hard reset, delete branch
 * - warning: Uncommitted changes, behind remote
 * - info: Tips, suggestions, educational content
 */
export type WarningCategory = 'critical' | 'warning' | 'info';

/**
 * Determine if warning should be shown based on level and category
 * - Beginner: Show all warnings
 * - Intermediate: Show critical and warning, skip info
 * - Expert: Only show critical
 */
export function shouldShowWarning(category: WarningCategory): boolean {
  const level = getLevel();
  if (level === 'beginner') {
    return true;
  }
  if (level === 'intermediate') {
    return category !== 'info';
  }
  // Expert: only critical
  return category === 'critical';
}

/**
 * Determine if educational explanations should be shown
 * Only shows for beginner level
 */
export function shouldShowExplanation(): boolean {
  return getLevel() === 'beginner';
}
