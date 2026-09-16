import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm, promptInput } from '../components/prompt.js';
import { successBox, warningBox, infoBox } from '../components/box.js';
import { gitService, SubmoduleInfo, WorktreeInfo } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { isValidRemoteUrl } from '../../utils/validators.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';

type AdvancedAction = 'submodules' | 'worktrees' | 'signing' | 'lfs' | 'back';

/**
 * The operations a real project eventually needs but a beginner never should:
 * submodules, worktrees and commit signing. Grouping them keeps the main menu
 * readable instead of growing it to twenty entries.
 */
export async function showAdvancedMenu(): Promise<void> {
  const theme = getTheme();
  let running = true;

  while (running) {
    logger.raw('\n' + theme.title(t('commands.advanced.title')) + '\n');

    const action = await promptSelect<AdvancedAction>(t('commands.advanced.selectAction'), [
      { name: theme.menuItem('S', t('commands.advanced.submodules')), value: 'submodules' },
      { name: theme.menuItem('W', t('commands.advanced.worktrees')), value: 'worktrees' },
      { name: theme.menuItem('G', t('commands.advanced.signing')), value: 'signing' },
      { name: theme.menuItem('L', t('commands.advanced.lfs')), value: 'lfs' },
      { name: theme.menuItem('B', t('menu.back')), value: 'back' }
    ]);

    if (action === 'back') {
      running = false;
      continue;
    }

    try {
      if (action === 'submodules') await submoduleSection();
      else if (action === 'worktrees') await worktreeSection();
      else if (action === 'signing') await signingSection();
      else await lfsSection();
    } catch (error) {
      logger.raw(warningBox(mapGitError(error)));
    }
  }
}

/* -------------------------------------------------------------- submodules */

function describeSubmodule(submodule: SubmoduleInfo): string {
  if (submodule.conflicted) return t('commands.advanced.subConflicted');
  if (!submodule.initialized) return t('commands.advanced.subUninitialized');
  if (submodule.modified) return t('commands.advanced.subModified');
  return t('commands.advanced.subUpToDate');
}

async function submoduleSection(): Promise<void> {
  const theme = getTheme();
  logger.raw('\n' + theme.title(t('commands.advanced.subTitle')) + '\n');

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.advanced.subExplain')));
  }

  logger.command('git submodule status');
  const submodules = await gitService.getSubmodules();

  if (submodules.length === 0) {
    logger.raw(infoBox(t('commands.advanced.subNone')));
  } else {
    logger.raw(theme.textMuted(`  ${t('commands.advanced.subCount', { count: submodules.length })}\n`));
    for (const submodule of submodules) {
      logger.raw(`  ${submodule.path.padEnd(28)} ${theme.commitHash(submodule.commit.substring(0, 7))}  ${theme.textMuted(describeSubmodule(submodule))}`);
    }
    logger.raw('');
  }

  const choices: { name: string; value: string }[] = [];
  // Initialising is only meaningful when something is declared but absent.
  if (submodules.some(submodule => !submodule.initialized)) {
    choices.push({ name: t('commands.advanced.subInit'), value: 'init' });
  }
  if (submodules.length > 0) {
    choices.push({ name: t('commands.advanced.subUpdate'), value: 'update' });
  }
  choices.push({ name: t('commands.advanced.subAdd'), value: 'add' });
  choices.push({ name: t('menu.back'), value: '' });

  const action = await promptSelect<string>(t('commands.advanced.selectAction'), choices);

  if (action === 'init') {
    logger.command('git submodule update --init --recursive');
    await gitService.initSubmodules();
    logger.raw(successBox(t('commands.advanced.subInitDone')));
    return;
  }

  if (action === 'update') {
    logger.raw(warningBox(t('commands.advanced.subUpdateWarning')));
    if (!(await promptConfirm(t('prompts.confirm'), false))) {
      return;
    }
    logger.command('git submodule update --remote --merge');
    await gitService.updateSubmodules();
    logger.raw(successBox(t('commands.advanced.subUpdateDone')));
    return;
  }

  if (action === 'add') {
    await addSubmodule();
  }
}

async function addSubmodule(): Promise<void> {
  const url = await promptInput(t('commands.advanced.subAddUrl'), '', (value: string) => {
    if (!value || value.trim().length === 0) return t('setup.remoteUrlRequired');
    if (!isValidRemoteUrl(value.trim())) return t('setup.remoteUrlInvalid');
    return true;
  });

  if (!url || url.trim().length === 0) return;

  const path = await promptInput(t('commands.advanced.subAddPath'), '', (value: string) =>
    value.trim().length > 0 ? true : t('commands.advanced.subPathRequired')
  );

  if (!path || path.trim().length === 0) return;

  logger.command(`git submodule add ${url.trim()} ${path.trim()}`);
  await gitService.addSubmodule(url.trim(), path.trim());
  logger.raw(successBox(t('commands.advanced.subAddDone', { path: path.trim() })));
}

/* --------------------------------------------------------------- worktrees */

function describeWorktree(worktree: WorktreeInfo, isFirst: boolean): string {
  const labels: string[] = [];
  if (isFirst) labels.push(t('commands.advanced.wtCurrent'));
  if (worktree.detached) labels.push(t('commands.advanced.wtDetached'));
  if (worktree.locked) labels.push(t('commands.advanced.wtLocked'));
  return labels.join(', ');
}

async function worktreeSection(): Promise<void> {
  const theme = getTheme();
  logger.raw('\n' + theme.title(t('commands.advanced.wtTitle')) + '\n');

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.advanced.wtExplain')));
  }

  logger.command('git worktree list');
  const worktrees = await gitService.getWorktrees();

  logger.raw(theme.textMuted(`  ${t('commands.advanced.wtCount', { count: worktrees.length })}\n`));
  worktrees.forEach((worktree, index) => {
    const notes = describeWorktree(worktree, index === 0);
    const branch = worktree.branch ?? '-';
    logger.raw(`  ${worktree.path}  ${theme.branch(branch)}${notes ? theme.textMuted(`  (${notes})`) : ''}`);
  });
  logger.raw('');

  const choices: { name: string; value: string }[] = [
    { name: t('commands.advanced.wtAdd'), value: 'add' }
  ];
  // git lists the main worktree first, and it cannot be removed.
  if (worktrees.length > 1) {
    choices.push({ name: t('commands.advanced.wtRemove'), value: 'remove' });
  }
  choices.push({ name: t('menu.back'), value: '' });

  const action = await promptSelect<string>(t('commands.advanced.selectAction'), choices);

  if (action === 'add') await addWorktree();
  else if (action === 'remove') await removeWorktree(worktrees);
}

async function addWorktree(): Promise<void> {
  const path = await promptInput(t('commands.advanced.wtAddPath'), '', (value: string) =>
    value.trim().length > 0 ? true : t('commands.advanced.subPathRequired')
  );

  if (!path || path.trim().length === 0) return;

  const branch = await promptInput(t('commands.advanced.wtAddBranch'), '', (value: string) =>
    value.trim().length > 0 ? true : t('commands.branch.invalidName')
  );

  if (!branch || branch.trim().length === 0) return;

  const create = await promptConfirm(t('commands.advanced.wtAddNewBranch'), false);

  logger.command(
    create
      ? `git worktree add -b ${branch.trim()} ${path.trim()}`
      : `git worktree add ${path.trim()} ${branch.trim()}`
  );
  await gitService.addWorktree(path.trim(), branch.trim(), create);
  logger.raw(successBox(t('commands.advanced.wtAdded', { path: path.trim() })));
}

async function removeWorktree(worktrees: WorktreeInfo[]): Promise<void> {
  // Skip index 0: git lists the main worktree first and refuses to remove it.
  const removable = worktrees.slice(1);

  if (removable.length === 0) {
    logger.raw(warningBox(t('commands.advanced.wtCannotRemoveMain')));
    return;
  }

  const selected = await promptSelect<string>(t('commands.advanced.wtSelectRemove'), [
    ...removable.map(worktree => ({ name: worktree.path, value: worktree.path })),
    { name: t('menu.back'), value: '' }
  ]);

  if (!selected) return;

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.advanced.wtRemoveExplain')));
  }

  if (!(await promptConfirm(t('commands.advanced.wtConfirmRemove', { path: selected }), false))) {
    return;
  }

  logger.command(`git worktree remove ${selected}`);
  await gitService.removeWorktree(selected);
  logger.raw(successBox(t('commands.advanced.wtRemoved')));
}

/* ----------------------------------------------------------------- signing */

async function signingSection(): Promise<void> {
  const theme = getTheme();
  logger.raw('\n' + theme.title(t('commands.advanced.signTitle')) + '\n');

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.advanced.signExplain')));
  }

  const { enabled, key } = await gitService.getSigningConfig();

  logger.raw(infoBox(
    t('commands.advanced.signStatus', {
      state: enabled ? t('commands.advanced.signOn') : t('commands.advanced.signOff')
    }) + '\n' +
    (key ? t('commands.advanced.signKey', { key }) : t('commands.advanced.signNoKey'))
  ));

  const choices: { name: string; value: string }[] = [
    { name: t('commands.advanced.signSetKey'), value: 'key' }
  ];
  choices.push(
    enabled
      ? { name: t('commands.advanced.signDisable'), value: 'off' }
      : { name: t('commands.advanced.signEnable'), value: 'on' }
  );
  choices.push({ name: t('menu.back'), value: '' });

  const action = await promptSelect<string>(t('commands.advanced.selectAction'), choices);

  if (action === 'key') {
    const value = await promptInput(t('commands.advanced.signKeyPrompt'), key ?? '');
    if (!value || value.trim().length === 0) return;

    logger.command(`git config --local user.signingkey ${value.trim()}`);
    await gitService.setSigningKey(value.trim());
    logger.raw(successBox(t('commands.advanced.signKeySet', { key: value.trim() })));
    return;
  }

  if (action === 'on') {
    // Turning signing on without a key makes every later commit fail, which is
    // a confusing way to discover the setting.
    if (!key) {
      logger.raw(warningBox(t('commands.advanced.signNeedsKey')));
      return;
    }
    logger.command('git config --local commit.gpgsign true');
    await gitService.setSigningEnabled(true);
    logger.raw(successBox(t('commands.advanced.signEnabled')));
    return;
  }

  if (action === 'off') {
    logger.command('git config --local commit.gpgsign false');
    await gitService.setSigningEnabled(false);
    logger.raw(successBox(t('commands.advanced.signDisabled')));
  }
}

/* --------------------------------------------------------------------- LFS */

/**
 * Git LFS: keep large binaries out of the history.
 *
 * LFS is a separate program, so the first thing this does is check whether it
 * exists. Everything else — tracking a pattern, listing what is stored — is
 * meaningless without it, and telling someone to install it is more use than
 * failing at the first command with a git error they did not cause.
 */
async function lfsSection(): Promise<void> {
  const theme = getTheme();
  logger.raw('\n' + theme.title(t('commands.advanced.lfsTitle')) + '\n');

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.advanced.lfsExplain')));
  }

  if (!(await gitService.isLfsAvailable())) {
    logger.raw(warningBox(t('commands.advanced.lfsMissing'), t('warnings.title')));
    logger.raw(infoBox(t('commands.advanced.lfsInstallHint')));
    return;
  }

  const initialized = await gitService.isLfsInitialized();

  if (!initialized) {
    logger.raw(infoBox(t('commands.advanced.lfsNotInitialized')));

    const setUp = await promptConfirm(t('commands.advanced.lfsInitQuestion'), true);
    if (!setUp) {
      return;
    }

    logger.command('git lfs install --local');
    await gitService.lfsInstall();
    logger.raw(successBox(t('commands.advanced.lfsInitialized')));
  }

  logger.command('git lfs track');
  const patterns = await gitService.getLfsPatterns();

  if (patterns.length === 0) {
    logger.raw(theme.textMuted(`  ${t('commands.advanced.lfsNoPatterns')}\n`));
  } else {
    logger.raw(theme.textMuted(`  ${t('commands.advanced.lfsPatternCount', { count: patterns.length })}\n`));
    patterns.forEach(pattern => logger.raw(`  ${pattern}`));
    logger.raw('');
  }

  const choices: Array<{ name: string; value: string }> = [
    { name: t('commands.advanced.lfsTrack'), value: 'track' }
  ];

  if (patterns.length > 0) {
    choices.push({ name: t('commands.advanced.lfsUntrack'), value: 'untrack' });
    choices.push({ name: t('commands.advanced.lfsList'), value: 'list' });
  }

  choices.push({ name: t('menu.back'), value: '' });

  const action = await promptSelect<string>(t('commands.advanced.selectAction'), choices);

  if (action === 'track') {
    await trackLfsPattern(patterns);
  } else if (action === 'untrack') {
    await untrackLfsPattern(patterns);
  } else if (action === 'list') {
    await listLfsFiles();
  }
}

async function trackLfsPattern(existing: string[]): Promise<void> {
  const pattern = await promptInput(t('commands.advanced.lfsEnterPattern'), '', value =>
    value.trim().length > 0 ? true : t('commands.advanced.lfsPatternRequired')
  );

  if (!pattern || pattern.trim().length === 0) {
    return;
  }

  const target = pattern.trim();

  if (existing.includes(target)) {
    logger.raw(infoBox(t('commands.advanced.lfsAlreadyTracked', { pattern: target })));
    return;
  }

  logger.command(`git lfs track "${target}"`);
  await gitService.lfsTrack(target);

  logger.raw(successBox(t('commands.advanced.lfsTracked', { pattern: target })));
  // Tracking edits .gitattributes, and that file has to be committed or the
  // rule exists only on this machine.
  logger.raw(infoBox(t('commands.advanced.lfsCommitAttributes')));
}

async function untrackLfsPattern(patterns: string[]): Promise<void> {
  const pattern = await promptSelect<string>(t('commands.advanced.lfsSelectUntrack'), [
    ...patterns.map(value => ({ name: value, value })),
    { name: t('menu.back'), value: '' }
  ]);

  if (!pattern) {
    return;
  }

  // Files already stored in LFS stay there; untracking only stops new ones
  // going in. Saying so avoids the belief that this pulls history back.
  if (!(await promptConfirm(t('commands.advanced.lfsUntrackConfirm', { pattern }), false))) {
    return;
  }

  logger.command(`git lfs untrack "${pattern}"`);
  await gitService.lfsUntrack(pattern);
  logger.raw(successBox(t('commands.advanced.lfsUntracked', { pattern })));
  logger.raw(infoBox(t('commands.advanced.lfsCommitAttributes')));
}

async function listLfsFiles(): Promise<void> {
  const theme = getTheme();

  logger.command('git lfs ls-files');
  const files = await gitService.getLfsFiles();

  if (files.length === 0) {
    logger.raw(infoBox(t('commands.advanced.lfsNoFiles')));
    return;
  }

  logger.raw('\n' + theme.textBold(t('commands.advanced.lfsFileCount', { count: files.length })) + '\n');
  files.forEach(file => logger.raw(`  ${file}`));
  logger.raw('');
}
