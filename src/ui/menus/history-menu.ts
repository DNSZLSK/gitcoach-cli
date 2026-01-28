import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptSelect } from '../components/prompt.js';
import { infoBox } from '../components/box.js';
import { gitService, CommitInfo } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';
import { shouldShowExplanation } from '../../utils/level-helper.js';

export type HistoryAction = 'view_more' | 'view_details' | 'back';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('time.justNow');
  if (diffMins < 60) return t('time.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('time.daysAgo', { count: diffDays });
  if (diffDays < 30) return t('time.weeksAgo', { count: Math.floor(diffDays / 7) });
  return t('time.monthsAgo', { count: Math.floor(diffDays / 30) });
}

function displayCommit(commit: CommitInfo, theme: ReturnType<typeof getTheme>): string {
  const hash = theme.commitHash(commit.hash);
  const message = commit.message.length > 50
    ? commit.message.substring(0, 47) + '...'
    : commit.message;
  const time = formatRelativeTime(commit.date);
  const author = theme.textMuted(`(${commit.author})`);

  return `  ${hash} ${message} ${theme.dim(time)} ${author}`;
}

export async function showHistoryMenu(): Promise<void> {
  const theme = getTheme();
  const pageSize = 10;
  let running = true;
  let firstRun = true;

  while (running) {
    logger.raw('\n' + theme.title(t('commands.history.title')) + '\n');

    // Show explanation for beginners (only on first display)
    if (firstRun && shouldShowExplanation()) {
      logger.raw(infoBox(
        t('commands.history.recentCommits'),
        t('commands.history.title')
      ));
      firstRun = false;
    }

    try {
      logger.command(`git log --oneline -${pageSize}`);
      const commits = await gitService.getLog(pageSize + 1);

      if (commits.length === 0) {
        logger.raw(infoBox(t('commands.history.noCommits')));
        return;
      }

      // Display commits
      logger.raw(theme.textBold(t('commands.history.recentCommits')) + '\n');

      const displayCommits = commits.slice(0, pageSize);
      displayCommits.forEach(commit => {
        logger.raw(displayCommit(commit, theme));
      });

      logger.raw('');

      // Build menu choices
      const choices: Array<{ name: string; value: HistoryAction | string }> = [];

      // Add each commit as a selectable option
      displayCommits.forEach(commit => {
        choices.push({
          name: `  ${theme.commitHash(commit.hash)} ${commit.message.substring(0, 40)}...`,
          value: commit.hash
        });
      });

      choices.push({
        name: theme.dim('─'.repeat(40)),
        value: 'separator',
        disabled: true
      } as { name: string; value: string; disabled?: boolean });

      if (commits.length > pageSize) {
        choices.push({
          name: theme.menuItem('M', t('commands.history.viewMore')),
          value: 'view_more'
        });
      }

      choices.push({
        name: theme.menuItem('B', t('menu.back')),
        value: 'back'
      });

      const action = await promptSelect<string>(t('commands.history.selectCommit'), choices);

      if (action === 'back' || action === 'separator') {
        running = false;
      } else if (action === 'view_more') {
        // Load more commits on next iteration
        continue;
      } else {
        // View commit details
        await showCommitDetails(action);
      }
    } catch (error) {
      logger.raw(theme.error(t('errors.generic', {
        message: error instanceof Error ? error.message : 'Unknown error'
      })));
      running = false;
    }
  }
}

async function showCommitDetails(hash: string): Promise<void> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.history.commitDetails')) + '\n');

  try {
    logger.command(`git show ${hash.substring(0, 7)}`);
    const commits = await gitService.getLog(50);
    const commit = commits.find(c => c.hash.startsWith(hash));

    if (!commit) {
      logger.raw(theme.error(t('commands.history.commitNotFound')));
      return;
    }

    // Display commit info
    logger.raw(theme.textBold(t('commands.history.commitLabel') + ' ') + theme.commitHash(commit.hash));
    logger.raw(theme.textBold(t('commands.history.authorLabel') + ' ') + commit.author);
    logger.raw(theme.textBold(t('commands.history.dateLabel') + ' ') + commit.date);
    logger.raw(theme.textBold(t('commands.history.messageLabel')));
    logger.raw('  ' + commit.message);
    logger.raw('');

    // Try to show changed files (this is a simplified version)
    logger.raw(theme.textMuted(t('commands.history.changedFiles')));
    logger.raw(theme.dim('  ' + t('commands.history.fullDiffHint', { hash: hash.substring(0, 7) })));
    logger.raw('');

  } catch (error) {
    logger.raw(theme.error(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })));
  }
}
