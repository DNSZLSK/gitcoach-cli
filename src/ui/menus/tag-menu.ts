import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect, promptConfirm, promptInput } from '../components/prompt.js';
import { successBox, warningBox, infoBox } from '../components/box.js';
import { gitService, TagInfo } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { mapGitError } from '../../utils/error-mapper.js';
import { isValidTagName } from '../../utils/validators.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';

type TagAction = 'list' | 'create' | 'delete' | 'push' | 'back';

export async function showTagMenu(): Promise<void> {
  const theme = getTheme();
  let running = true;

  while (running) {
    logger.raw('\n' + theme.title(t('commands.tags.title')) + '\n');

    let tags: TagInfo[] = [];
    try {
      tags = await gitService.getTags();
    } catch (error) {
      logger.raw(warningBox(mapGitError(error)));
      return;
    }

    if (tags.length === 0) {
      logger.raw(infoBox(t('commands.tags.noTags')));
    } else {
      logger.raw(theme.textMuted(`  ${t('commands.tags.tagCount', { count: tags.length })}\n`));
    }

    if (shouldShowExplanation()) {
      logger.raw(infoBox(t('commands.tags.explainTag')));
    }

    const choices: { name: string; value: TagAction }[] = [
      { name: theme.menuItem('C', t('commands.tags.create')), value: 'create' }
    ];

    // Listing, deleting and pushing are meaningless with nothing tagged yet.
    if (tags.length > 0) {
      choices.unshift({ name: theme.menuItem('L', t('commands.tags.list')), value: 'list' });
      choices.push(
        { name: theme.menuItem('P', t('commands.tags.push')), value: 'push' },
        { name: theme.menuItem('D', t('commands.tags.delete')), value: 'delete' }
      );
    }

    choices.push({ name: theme.menuItem('B', t('menu.back')), value: 'back' });

    const action = await promptSelect<TagAction>(t('commands.tags.selectAction'), choices);

    if (action === 'back') {
      running = false;
      continue;
    }

    try {
      await handleTagAction(action, tags);
    } catch (error) {
      logger.raw(warningBox(mapGitError(error)));
    }
  }
}

async function handleTagAction(action: TagAction, tags: TagInfo[]): Promise<void> {
  switch (action) {
    case 'list':
      listTags(tags);
      break;

    case 'create':
      await createTag();
      break;

    case 'delete':
      await deleteTag(tags);
      break;

    case 'push':
      await pushTags();
      break;
  }
}

function listTags(tags: TagInfo[]): void {
  const theme = getTheme();
  logger.command('git tag -n --sort=-creatordate');

  for (const tag of tags) {
    const kind = tag.annotated
      ? t('commands.tags.annotated')
      : t('commands.tags.lightweight');
    const line = `  ${tag.name.padEnd(16)} ${tag.commit.padEnd(10)} ${tag.date}  ${theme.textMuted(`(${kind})`)}`;
    logger.raw(tag.message ? `${line}  ${tag.message}` : line);
  }

  logger.raw('');
}

async function createTag(): Promise<void> {
  const name = await promptInput(t('commands.tags.namePrompt'), '', (value: string) => {
    if (!value || value.trim().length === 0) {
      return t('commands.tags.nameRequired');
    }
    if (!isValidTagName(value.trim())) {
      return t('commands.tags.nameInvalid');
    }
    return true;
  });

  if (!name || name.trim().length === 0) {
    return;
  }

  const tagName = name.trim();

  if (await gitService.tagExists(tagName)) {
    logger.raw(warningBox(t('commands.tags.nameExists', { name: tagName })));
    return;
  }

  if (shouldShowExplanation()) {
    logger.raw(infoBox(t('commands.tags.annotatedExplain')));
  }

  const message = await promptInput(t('commands.tags.messagePrompt'), '');
  const annotation = message && message.trim().length > 0 ? message.trim() : undefined;

  logger.command(annotation ? `git tag -a ${tagName} -m "${annotation}"` : `git tag ${tagName}`);
  await gitService.createTag(tagName, annotation);
  logger.raw(successBox(t('commands.tags.created', { name: tagName })));

  // A tag that stays local helps nobody, so offer the follow-up rather than
  // making the user come back through the menu for it.
  if (await gitService.hasRemote()) {
    const push = await promptConfirm(t('commands.tags.pushOne'), true);
    if (push) {
      await pushSingleTag(tagName);
    }
  }
}

async function deleteTag(tags: TagInfo[]): Promise<void> {
  const selected = await promptSelect<string>(
    t('commands.tags.selectToDelete'),
    [
      ...tags.map(tag => ({ name: tag.name, value: tag.name })),
      { name: t('menu.back'), value: '' }
    ]
  );

  if (!selected) {
    return;
  }

  if (!(await promptConfirm(t('commands.tags.confirmDelete', { name: selected }), false))) {
    return;
  }

  logger.command(`git tag -d ${selected}`);
  await gitService.deleteTag(selected);
  logger.raw(successBox(t('commands.tags.deleted', { name: selected })));

  // Only offer the remote deletion when the tag is actually published there.
  let publishedRemotely = false;
  try {
    publishedRemotely = !(await gitService.getUnpushedTags()).includes(selected);
  } catch {
    logger.debug('Could not reach the remote to check for a published tag');
    return;
  }

  if (!publishedRemotely) {
    return;
  }

  logger.raw(warningBox(t('commands.tags.remoteDeleteWarning')));

  if (await promptConfirm(t('commands.tags.alsoDeleteRemote'), false)) {
    logger.command(`git push origin --delete ${selected}`);
    await gitService.deleteRemoteTag(selected);
    logger.raw(successBox(t('commands.tags.deletedRemote', { name: selected })));
  }
}

async function pushTags(): Promise<void> {
  if (!(await gitService.hasRemote())) {
    logger.raw(warningBox(t('commands.tags.noRemote')));
    return;
  }

  let unpushed: string[];
  try {
    unpushed = await gitService.getUnpushedTags();
  } catch {
    // The comparison needs the network; say so instead of implying all is well.
    logger.raw(warningBox(t('commands.tags.remoteCheckFailed')));
    return;
  }

  if (unpushed.length === 0) {
    logger.raw(infoBox(t('commands.tags.allPushed')));
    return;
  }

  logger.raw(infoBox(
    t('commands.tags.unpushedCount', { count: unpushed.length, names: unpushed.join(', ') })
  ));

  const choice = await promptSelect<'one' | 'all' | 'back'>(t('commands.tags.selectAction'), [
    { name: t('commands.tags.pushAll'), value: 'all' },
    { name: t('commands.tags.pushOne'), value: 'one' },
    { name: t('menu.back'), value: 'back' }
  ]);

  if (choice === 'back') {
    return;
  }

  if (choice === 'all') {
    logger.command('git push origin --tags');
    await gitService.pushAllTags();
    logger.raw(successBox(t('commands.tags.pushedAll', { remote: 'origin' })));
    return;
  }

  const selected = await promptSelect<string>(t('commands.tags.selectToPush'), [
    ...unpushed.map(name => ({ name, value: name })),
    { name: t('menu.back'), value: '' }
  ]);

  if (selected) {
    await pushSingleTag(selected);
  }
}

async function pushSingleTag(name: string): Promise<void> {
  logger.command(`git push origin ${name}`);
  await gitService.pushTag(name);
  logger.raw(successBox(t('commands.tags.pushed', { name, remote: 'origin' })));
}
