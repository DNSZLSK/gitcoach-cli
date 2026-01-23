import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { promptCheckbox, promptConfirm } from '../components/prompt.js';
import { successBox, infoBox } from '../components/box.js';
import { withSpinner } from '../components/spinner.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';

export interface AddResult {
  staged: string[];
  cancelled: boolean;
}

export async function showAddMenu(): Promise<AddResult> {
  const theme = getTheme();

  logger.raw('\n' + theme.title(t('commands.add.title')) + '\n');

  try {
    const status = await gitService.getStatus();

    // Collect all files that can be staged
    const unstaged = [
      ...status.modified.map(f => ({ name: f, status: 'modified' as const })),
      ...status.deleted.map(f => ({ name: f, status: 'deleted' as const })),
      ...status.untracked.map(f => ({ name: f, status: 'untracked' as const }))
    ];

    if (unstaged.length === 0) {
      logger.raw(infoBox(t('commands.add.noFiles')));
      return { staged: [], cancelled: false };
    }

    // Create checkbox choices
    const choices = unstaged.map(file => ({
      name: theme.file(file.name, file.status),
      value: file.name,
      checked: false
    }));

    // Add "stage all" option at the beginning
    const addAll = await promptConfirm(t('commands.add.allFiles'), false);

    let filesToStage: string[];

    if (addAll) {
      filesToStage = unstaged.map(f => f.name);
    } else {
      filesToStage = await promptCheckbox(t('commands.add.selectFiles'), choices);
    }

    if (filesToStage.length === 0) {
      return { staged: [], cancelled: true };
    }

    // Stage the selected files
    if (addAll) {
      logger.command('git add -A');
    } else {
      filesToStage.forEach(f => logger.command(`git add "${f}"`));
    }

    await withSpinner(
      `Staging ${filesToStage.length} file(s)...`,
      async () => {
        await gitService.add(filesToStage);
      },
      t('commands.add.success', { count: filesToStage.length })
    );

    // Show what was staged
    logger.raw('\n' + successBox(
      filesToStage.map(f => t('commands.add.staged', { file: f })).join('\n'),
      t('success.title')
    ));

    return { staged: filesToStage, cancelled: false };
  } catch (error) {
    logger.error(t('errors.generic', { message: error instanceof Error ? error.message : 'Unknown error' }));
    return { staged: [], cancelled: true };
  }
}
