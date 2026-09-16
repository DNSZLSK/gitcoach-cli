import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptInput, promptConfirm, promptCheckbox } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';
import {
  GITIGNORE_TEMPLATES,
  GitignoreTemplate,
  addPatterns,
  hasGitignore,
  readGitignore,
  readPatterns,
  removePattern,
  writeTemplate
} from '../../utils/gitignore.js';

export type GitignoreAction =
  | 'view'
  | 'ignore_untracked'
  | 'add_pattern'
  | 'remove_pattern'
  | 'template'
  | 'check'
  | 'back';

export interface GitignoreResult {
  action: GitignoreAction;
  changed: boolean;
}

const done = (action: GitignoreAction, changed = false): GitignoreResult => ({ action, changed });

export async function showGitignoreMenu(): Promise<GitignoreResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.gitignore.title')) + '\n');

  try {
    const root = await gitService.getRepoRoot();
    const patterns = readPatterns(root);

    if (shouldShowExplanation()) {
      logger.raw(infoBox(t('commands.gitignore.explain'), t('commands.gitignore.title')));
    }

    logger.raw(
      theme.textMuted(
        hasGitignore(root)
          ? t('commands.gitignore.count', { count: patterns.length })
          : t('commands.gitignore.none')
      ) + '\n'
    );

    const choices: Array<{ name: string; value: GitignoreAction }> = [];

    if (hasGitignore(root)) {
      choices.push({ name: theme.menuItem('V', t('commands.gitignore.view')), value: 'view' });
    }

    choices.push({
      name: theme.menuItem('I', t('commands.gitignore.ignoreUntracked')),
      value: 'ignore_untracked'
    });
    choices.push({ name: theme.menuItem('A', t('commands.gitignore.addPattern')), value: 'add_pattern' });

    if (patterns.length > 0) {
      choices.push({
        name: theme.menuItem('R', t('commands.gitignore.removePattern')),
        value: 'remove_pattern'
      });
    }

    choices.push({ name: theme.menuItem('T', t('commands.gitignore.template')), value: 'template' });
    choices.push({ name: theme.menuItem('C', t('commands.gitignore.check')), value: 'check' });
    choices.push({ name: theme.menuItem('B', t('menu.back')), value: 'back' });

    const action = await promptSelect<GitignoreAction>(t('prompts.select'), choices);

    switch (action) {
      case 'view':
        return viewGitignore(root);
      case 'ignore_untracked':
        return await ignoreUntracked(root);
      case 'add_pattern':
        return await addPattern(root);
      case 'remove_pattern':
        return await dropPattern(root, patterns);
      case 'template':
        return await applyTemplate(root);
      case 'check':
        return await checkPath();
      case 'back':
      default:
        return done('back');
    }
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
    return done('back');
  }
}

function viewGitignore(root: string): GitignoreResult {
  const theme = getTheme();
  const contents = readGitignore(root);

  logger.raw('\n' + theme.subtitle(t('commands.gitignore.view')) + '\n');
  for (const line of contents.split(/\r?\n/)) {
    logger.raw(line.trim().startsWith('#') ? theme.textMuted(line) : line);
  }
  logger.raw('');

  return done('view');
}

/**
 * Ignore files git can currently see but is not tracking.
 *
 * This is the entry most people actually want: the junk is already on screen
 * in `git status`, and typing its path by hand is how typos get into a
 * .gitignore.
 */
async function ignoreUntracked(root: string): Promise<GitignoreResult> {
  const theme = getTheme();
  const status = await gitService.getStatus();

  if (status.untracked.length === 0) {
    logger.raw(infoBox(t('commands.gitignore.noUntracked')));
    return done('ignore_untracked');
  }

  const selected = await promptCheckbox<string>(
    t('commands.gitignore.selectUntracked'),
    status.untracked.map(file => ({ name: theme.file(file, 'untracked'), value: file, checked: false }))
  );

  if (selected.length === 0) {
    return done('ignore_untracked');
  }

  const added = addPatterns(root, selected);

  if (added.length === 0) {
    logger.raw(infoBox(t('commands.gitignore.alreadyIgnored')));
    return done('ignore_untracked');
  }

  logger.raw('\n' + successBox(t('commands.gitignore.added', { count: added.length })));
  return done('ignore_untracked', true);
}

async function addPattern(root: string): Promise<GitignoreResult> {
  const pattern = await promptInput(t('commands.gitignore.enterPattern'), '', value =>
    value.trim().length > 0 ? true : t('commands.gitignore.patternRequired')
  );

  if (!pattern || pattern.trim().length === 0) {
    return done('add_pattern');
  }

  const added = addPatterns(root, [pattern]);

  if (added.length === 0) {
    logger.raw(infoBox(t('commands.gitignore.alreadyPresent', { pattern: pattern.trim() })));
    return done('add_pattern');
  }

  logger.raw('\n' + successBox(t('commands.gitignore.added', { count: added.length })));

  // An ignore rule has no effect on a file git already tracks. Saying nothing
  // here is how someone ends up believing a secret is ignored when every
  // change to it is still being committed.
  await offerToUntrack(pattern.trim());

  return done('add_pattern', true);
}

/**
 * Point out that a pattern matches something already tracked, and offer the
 * `git rm --cached` that actually makes the ignore take effect.
 */
async function offerToUntrack(pattern: string): Promise<void> {
  if (!(await gitService.isTracked(pattern))) {
    return;
  }

  logger.raw(warningBox(t('commands.gitignore.stillTracked', { pattern }), t('warnings.title')));

  const untrack = await promptConfirm(t('commands.gitignore.untrackQuestion', { pattern }), false);
  if (!untrack) {
    return;
  }

  try {
    logger.command(`git rm --cached -r -- ${pattern}`);
    await gitService.untrackKeepingFile(pattern);
    logger.raw(successBox(t('commands.gitignore.untracked', { pattern })));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function dropPattern(root: string, patterns: string[]): Promise<GitignoreResult> {
  const pattern = await promptSelect<string>(t('commands.gitignore.selectToRemove'), [
    ...patterns.map(value => ({ name: value, value })),
    { name: t('menu.back'), value: '' }
  ]);

  if (!pattern) {
    return done('remove_pattern');
  }

  if (!(await promptConfirm(t('commands.gitignore.removeConfirm', { pattern }), false))) {
    return done('remove_pattern');
  }

  if (!removePattern(root, pattern)) {
    logger.raw(warningBox(t('commands.gitignore.notFound', { pattern })));
    return done('remove_pattern');
  }

  logger.raw('\n' + successBox(t('commands.gitignore.removed', { pattern })));
  return done('remove_pattern', true);
}

/**
 * Write a starter .gitignore for a kind of project.
 *
 * Replacing an existing file is the one destructive thing this menu does, so
 * it is confirmed, and the confirmation defaults to no.
 */
async function applyTemplate(root: string): Promise<GitignoreResult> {
  const template = await promptSelect<GitignoreTemplate | ''>(t('commands.gitignore.selectTemplate'), [
    ...(Object.keys(GITIGNORE_TEMPLATES) as GitignoreTemplate[]).map(name => ({
      name: t(`commands.gitignore.template_${name}`),
      value: name
    })),
    { name: t('menu.back'), value: '' as const }
  ]);

  if (!template) {
    return done('template');
  }

  if (hasGitignore(root)) {
    const overwrite = await promptConfirm(t('commands.gitignore.overwriteConfirm'), false);
    if (!overwrite) {
      return done('template');
    }
  }

  writeTemplate(root, template);
  logger.raw('\n' + successBox(t('commands.gitignore.templateWritten')));
  return done('template', true);
}

/**
 * Answer "why is this file not showing up?" — the question ignore rules are
 * usually met through.
 */
async function checkPath(): Promise<GitignoreResult> {
  const path = await promptInput(t('commands.gitignore.enterPath'), '', value =>
    value.trim().length > 0 ? true : t('commands.gitignore.pathRequired')
  );

  if (!path || path.trim().length === 0) {
    return done('check');
  }

  const target = path.trim();
  logger.command(`git check-ignore -q -- ${target}`);

  if (await gitService.isIgnored(target)) {
    logger.raw(infoBox(t('commands.gitignore.isIgnored', { path: target })));
  } else {
    logger.raw(infoBox(t('commands.gitignore.notIgnored', { path: target })));
  }

  return done('check');
}
