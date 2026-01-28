import { gitService } from './git-service.js';
import { userConfig } from '../config/user-config.js';
import { t } from '../i18n/index.js';

export type WarningLevel = 'info' | 'warning' | 'critical';

export interface Warning {
  level: WarningLevel;
  title: string;
  message: string;
  action: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: Warning[];
  canProceed: boolean;
}

class PreventionService {
  async checkUncommittedChanges(): Promise<Warning | null> {
    try {
      const hasChanges = await gitService.hasUncommittedChanges();

      if (hasChanges) {
        userConfig.incrementErrorsPrevented();
        return {
          level: 'warning',
          title: t('warnings.title'),
          message: t('warnings.uncommittedChanges'),
          action: t('warnings.uncommittedChangesAction')
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async checkForcePush(): Promise<Warning | null> {
    userConfig.incrementErrorsPrevented();
    return {
      level: 'critical',
      title: t('warnings.title'),
      message: t('warnings.forcePush'),
      action: t('warnings.forcePushAction')
    };
  }

  async checkWrongBranch(expectedBranch: string): Promise<Warning | null> {
    try {
      const currentBranch = await gitService.getCurrentBranch();

      if (currentBranch && currentBranch !== expectedBranch) {
        userConfig.incrementErrorsPrevented();
        return {
          level: 'warning',
          title: t('warnings.title'),
          message: t('warnings.wrongBranch', { current: currentBranch, expected: expectedBranch }),
          action: t('warnings.wrongBranchAction')
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async checkDetachedHead(): Promise<Warning | null> {
    try {
      const isDetached = await gitService.isDetachedHead();

      if (isDetached) {
        userConfig.incrementErrorsPrevented();
        return {
          level: 'warning',
          title: t('warnings.title'),
          message: t('warnings.detachedHead'),
          action: t('warnings.detachedHeadAction')
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async checkNoRemote(): Promise<Warning | null> {
    try {
      const hasRemote = await gitService.hasRemote();

      if (!hasRemote) {
        return {
          level: 'info',
          title: t('warnings.title'),
          message: t('warnings.noRemote'),
          action: ''
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async checkNotGitRepo(): Promise<Warning | null> {
    try {
      const isRepo = await gitService.isGitRepo();

      if (!isRepo) {
        return {
          level: 'critical',
          title: t('warnings.title'),
          message: t('warnings.notGitRepo'),
          action: ''
        };
      }

      return null;
    } catch {
      return {
        level: 'critical',
        title: t('warnings.title'),
        message: t('warnings.notGitRepo'),
        action: ''
      };
    }
  }

  async validateCheckout(_targetBranch: string): Promise<ValidationResult> {
    const warnings: Warning[] = [];

    // Check for uncommitted changes
    const uncommittedWarning = await this.checkUncommittedChanges();
    if (uncommittedWarning) {
      warnings.push(uncommittedWarning);
    }

    return {
      valid: warnings.length === 0,
      warnings,
      canProceed: !warnings.some(w => w.level === 'critical')
    };
  }

  async validatePush(force: boolean = false): Promise<ValidationResult> {
    const warnings: Warning[] = [];

    // Check for detached HEAD
    const detachedWarning = await this.checkDetachedHead();
    if (detachedWarning) {
      warnings.push(detachedWarning);
    }

    // Note: no remote check is handled directly by push-menu
    // which offers to add a remote interactively before reaching this point

    // Check force push
    if (force) {
      const forcePushWarning = await this.checkForcePush();
      if (forcePushWarning) {
        warnings.push(forcePushWarning);
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      canProceed: !warnings.some(w => w.level === 'critical' && !force)
    };
  }

  async validateCommit(): Promise<ValidationResult> {
    const warnings: Warning[] = [];

    // Check for detached HEAD
    const detachedWarning = await this.checkDetachedHead();
    if (detachedWarning) {
      warnings.push(detachedWarning);
    }

    // Check for staged files
    const stagedFiles = await gitService.getStagedFiles();
    if (stagedFiles.length === 0) {
      warnings.push({
        level: 'info',
        title: t('warnings.title'),
        message: t('commands.commit.noStaged'),
        action: ''
      });
    }

    return {
      valid: stagedFiles.length > 0,
      warnings,
      canProceed: stagedFiles.length > 0
    };
  }

  async validatePull(): Promise<ValidationResult> {
    const warnings: Warning[] = [];

    // Check for uncommitted changes (could cause merge conflicts)
    const uncommittedWarning = await this.checkUncommittedChanges();
    if (uncommittedWarning) {
      warnings.push({
        ...uncommittedWarning,
        level: 'info' // Downgrade to info for pull
      });
    }

    // Check for no remote
    const noRemoteWarning = await this.checkNoRemote();
    if (noRemoteWarning) {
      warnings.push(noRemoteWarning);
    }

    return {
      valid: true,
      warnings,
      canProceed: !warnings.some(w => w.level === 'critical')
    };
  }

  async validateBranchDelete(branchName: string): Promise<ValidationResult> {
    const warnings: Warning[] = [];

    // Check if trying to delete current branch
    const currentBranch = await gitService.getCurrentBranch();
    if (currentBranch === branchName) {
      warnings.push({
        level: 'critical',
        title: t('warnings.title'),
        message: t('commands.branch.cannotDeleteCurrent'),
        action: ''
      });
    }

    return {
      valid: currentBranch !== branchName,
      warnings,
      canProceed: currentBranch !== branchName
    };
  }

  shouldConfirmAction(): boolean {
    return userConfig.getConfirmDestructiveActions();
  }
}

export const preventionService = new PreventionService();
export default preventionService;
