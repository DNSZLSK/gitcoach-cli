import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm, promptInput } from '../components/prompt.js';
import { successBox, warningBox, errorBox, infoBox } from '../components/box.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';

export type StashAction = 'save' | 'list' | 'apply' | 'pop' | 'drop' | 'back';

export async function showStashMenu(): Promise<void> {
  const theme = getTheme();

  let running = true;

  while (running) {
    logger.raw('\n' + theme.title(t('commands.stash.title')) + '\n');

    const choices = [
      {
        name: theme.menuItem('S', t('commands.stash.save')),
        value: 'save' as StashAction,
        description: t('commands.stash.saveDesc')
      },
      {
        name: theme.menuItem('L', t('commands.stash.list')),
        value: 'list' as StashAction,
        description: t('commands.stash.listDesc')
      },
      {
        name: theme.menuItem('A', t('commands.stash.apply')),
        value: 'apply' as StashAction,
        description: t('commands.stash.applyDesc')
      },
      {
        name: theme.menuItem('P', t('commands.stash.pop')),
        value: 'pop' as StashAction,
        description: t('commands.stash.popDesc')
      },
      {
        name: theme.menuItem('D', t('commands.stash.drop')),
        value: 'drop' as StashAction,
        description: t('commands.stash.dropDesc')
      },
      {
        name: theme.dim('─'.repeat(40)),
        value: 'separator' as StashAction,
        disabled: true
      },
      {
        name: theme.menuItem('B', t('menu.back')),
        value: 'back' as StashAction
      }
    ];

    const action = await promptSelect<StashAction>(t('commands.stash.selectAction'), choices);

    switch (action) {
      case 'save':
        await handleStashSave();
        break;
      case 'list':
        await handleStashList();
        break;
      case 'apply':
        await handleStashApply();
        break;
      case 'pop':
        await handleStashPop();
        break;
      case 'drop':
        await handleStashDrop();
        break;
      case 'back':
        running = false;
        break;
    }
  }
}

async function handleStashSave(): Promise<void> {
  const theme = getTheme();

  // Check for uncommitted changes
  const hasChanges = await gitService.hasUncommittedChanges();

  if (!hasChanges) {
    logger.raw(infoBox(t('commands.stash.nothingToStash')));
    return;
  }

  // Show explanation for beginners only
  if (shouldShowExplanation()) {
    logger.raw(infoBox(
      t('commands.stash.saveExplain'),
      t('commands.stash.whatItDoes')
    ));
  }

  // Ask for optional message
  const message = await promptInput(t('commands.stash.enterMessage'), '');

  try {
    if (message && message.trim()) {
      logger.command(`git stash save "${message.trim()}"`);
      await gitService.stash(message.trim());
    } else {
      logger.command('git stash');
      await gitService.stash();
    }

    logger.raw('\n' + successBox(t('commands.stash.saveSuccess')));
    logger.raw(theme.info(t('commands.stash.workingTreeClean')) + '\n');
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleStashList(): Promise<void> {
  const theme = getTheme();

  try {
    logger.command('git stash list');
    const stashes = await getStashList();

    if (stashes.length === 0) {
      logger.raw(infoBox(t('commands.stash.noStashes')));
      return;
    }

    logger.raw('\n' + theme.textBold(t('commands.stash.yourStashes')) + '\n');

    stashes.forEach((stash, index) => {
      logger.raw(`  ${theme.info(`stash@{${index}}`)} ${stash}`);
    });

    logger.raw('');
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleStashApply(): Promise<void> {
  const theme = getTheme();

  const stashes = await getStashList();

  if (stashes.length === 0) {
    logger.raw(infoBox(t('commands.stash.noStashes')));
    return;
  }

  // Show explanation for beginners only
  if (shouldShowExplanation()) {
    logger.raw(infoBox(
      t('commands.stash.applyExplain'),
      t('commands.stash.whatItDoes')
    ));
  }

  const choices = stashes.map((stash, index) => ({
    name: `${theme.info(`stash@{${index}}`)} ${stash}`,
    value: index
  }));

  const selectedIndex = await promptSelect<number>(t('commands.stash.selectStash'), choices);

  try {
    logger.command(`git stash apply stash@{${selectedIndex}}`);
    await gitService.stashApply(selectedIndex);
    logger.raw('\n' + successBox(t('commands.stash.applySuccess')));
    logger.raw(theme.info(t('commands.stash.stashKept')) + '\n');
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleStashPop(): Promise<void> {
  const stashes = await getStashList();

  if (stashes.length === 0) {
    logger.raw(infoBox(t('commands.stash.noStashes')));
    return;
  }

  // Show explanation for beginners only
  if (shouldShowExplanation()) {
    logger.raw(infoBox(
      t('commands.stash.popExplain'),
      t('commands.stash.whatItDoes')
    ));
  }

  try {
    logger.command('git stash pop');
    await gitService.stashPop();
    logger.raw('\n' + successBox(t('commands.stash.popSuccess')));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function handleStashDrop(): Promise<void> {
  const theme = getTheme();

  const stashes = await getStashList();

  if (stashes.length === 0) {
    logger.raw(infoBox(t('commands.stash.noStashes')));
    return;
  }

  // Warning
  logger.raw(warningBox(
    t('commands.stash.dropWarning'),
    t('warnings.title')
  ));

  const choices = stashes.map((stash, index) => ({
    name: `${theme.info(`stash@{${index}}`)} ${stash}`,
    value: index
  }));

  const selectedIndex = await promptSelect<number>(t('commands.stash.selectStashToDrop'), choices);

  const confirm = await promptConfirm(t('commands.stash.confirmDrop'), false);

  if (!confirm) {
    logger.raw(theme.textMuted(t('prompts.cancel')) + '\n');
    return;
  }

  try {
    logger.command(`git stash drop stash@{${selectedIndex}}`);
    await gitService.stashDrop(selectedIndex);
    logger.raw('\n' + successBox(t('commands.stash.dropSuccess')));
  } catch (error) {
    logger.raw(errorBox(mapGitError(error)));
  }
}

async function getStashList(): Promise<string[]> {
  try {
    return await gitService.getStashList();
  } catch {
    return [];
  }
}
