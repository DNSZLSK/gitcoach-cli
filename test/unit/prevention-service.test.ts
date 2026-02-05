import { preventionService } from '../../src/services/prevention-service.js';

// Mock i18n
jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result += `:${k}=${v}`;
      }
      return result;
    }
    return key;
  }
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    raw: jest.fn(),
    command: jest.fn(),
    success: jest.fn()
  }
}));

// Mock user config
jest.mock('../../src/config/user-config.js', () => ({
  userConfig: {
    incrementErrorsPrevented: jest.fn(),
    getConfirmDestructiveActions: jest.fn().mockReturnValue(true)
  }
}));

// Mock git service - must be inline in factory since jest.mock is hoisted
jest.mock('../../src/services/git-service.js', () => ({
  gitService: {
    hasUncommittedChanges: jest.fn(),
    getCurrentBranch: jest.fn(),
    isDetachedHead: jest.fn(),
    hasRemote: jest.fn(),
    isGitRepo: jest.fn(),
    getStagedFiles: jest.fn(),
    isMergeInProgress: jest.fn(),
    isRebaseInProgress: jest.fn(),
    isCherryPickInProgress: jest.fn(),
    isBisectInProgress: jest.fn()
  }
}));

// Get reference to the mocked git service
import { gitService } from '../../src/services/git-service.js';
const mockGitService = gitService as jest.Mocked<typeof gitService>;

describe('PreventionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUncommittedChanges', () => {
    it('should return warning when there are uncommitted changes', async () => {
      mockGitService.hasUncommittedChanges.mockResolvedValue(true);
      const result = await preventionService.checkUncommittedChanges();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('warning');
      expect(result!.message).toBe('warnings.uncommittedChanges');
    });

    it('should return null when there are no uncommitted changes', async () => {
      mockGitService.hasUncommittedChanges.mockResolvedValue(false);
      const result = await preventionService.checkUncommittedChanges();
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGitService.hasUncommittedChanges.mockRejectedValue(new Error('git error'));
      const result = await preventionService.checkUncommittedChanges();
      expect(result).toBeNull();
    });
  });

  describe('checkForcePush', () => {
    it('should always return a critical warning', async () => {
      const result = await preventionService.checkForcePush();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('critical');
      expect(result!.message).toBe('warnings.forcePush');
    });
  });

  describe('checkWrongBranch', () => {
    it('should return warning when on wrong branch', async () => {
      mockGitService.getCurrentBranch.mockResolvedValue('feature');
      const result = await preventionService.checkWrongBranch('main');
      expect(result).not.toBeNull();
      expect(result!.level).toBe('warning');
    });

    it('should return null when on expected branch', async () => {
      mockGitService.getCurrentBranch.mockResolvedValue('main');
      const result = await preventionService.checkWrongBranch('main');
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGitService.getCurrentBranch.mockRejectedValue(new Error('git error'));
      const result = await preventionService.checkWrongBranch('main');
      expect(result).toBeNull();
    });
  });

  describe('checkDetachedHead', () => {
    it('should return warning when in detached HEAD state', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(true);
      const result = await preventionService.checkDetachedHead();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('warning');
    });

    it('should return null when not detached', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(false);
      const result = await preventionService.checkDetachedHead();
      expect(result).toBeNull();
    });
  });

  describe('checkNoRemote', () => {
    it('should return info when no remote configured', async () => {
      mockGitService.hasRemote.mockResolvedValue(false);
      const result = await preventionService.checkNoRemote();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('info');
    });

    it('should return null when remote exists', async () => {
      mockGitService.hasRemote.mockResolvedValue(true);
      const result = await preventionService.checkNoRemote();
      expect(result).toBeNull();
    });
  });

  describe('checkNotGitRepo', () => {
    it('should return critical when not a git repo', async () => {
      mockGitService.isGitRepo.mockResolvedValue(false);
      const result = await preventionService.checkNotGitRepo();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('critical');
    });

    it('should return null when is a git repo', async () => {
      mockGitService.isGitRepo.mockResolvedValue(true);
      const result = await preventionService.checkNotGitRepo();
      expect(result).toBeNull();
    });

    it('should return critical on error', async () => {
      mockGitService.isGitRepo.mockRejectedValue(new Error('git error'));
      const result = await preventionService.checkNotGitRepo();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('critical');
    });
  });

  describe('checkMergeInProgress', () => {
    it('should return critical when merge is in progress', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(true);
      const result = await preventionService.checkMergeInProgress();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('critical');
      expect(result!.message).toBe('warnings.mergeInProgress');
    });

    it('should return null when no merge in progress', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(false);
      const result = await preventionService.checkMergeInProgress();
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGitService.isMergeInProgress.mockRejectedValue(new Error('git error'));
      const result = await preventionService.checkMergeInProgress();
      expect(result).toBeNull();
    });
  });

  describe('checkRebaseInProgress', () => {
    it('should return critical when rebase is in progress', async () => {
      mockGitService.isRebaseInProgress.mockResolvedValue(true);
      const result = await preventionService.checkRebaseInProgress();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('critical');
      expect(result!.message).toBe('warnings.rebaseInProgress');
    });

    it('should return null when no rebase in progress', async () => {
      mockGitService.isRebaseInProgress.mockResolvedValue(false);
      const result = await preventionService.checkRebaseInProgress();
      expect(result).toBeNull();
    });
  });

  describe('checkCherryPickInProgress', () => {
    it('should return warning when cherry-pick is in progress', async () => {
      mockGitService.isCherryPickInProgress.mockResolvedValue(true);
      const result = await preventionService.checkCherryPickInProgress();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('warning');
      expect(result!.message).toBe('warnings.cherryPickInProgress');
    });

    it('should return null when no cherry-pick in progress', async () => {
      mockGitService.isCherryPickInProgress.mockResolvedValue(false);
      const result = await preventionService.checkCherryPickInProgress();
      expect(result).toBeNull();
    });
  });

  describe('checkBisectInProgress', () => {
    it('should return warning when bisect is in progress', async () => {
      mockGitService.isBisectInProgress.mockResolvedValue(true);
      const result = await preventionService.checkBisectInProgress();
      expect(result).not.toBeNull();
      expect(result!.level).toBe('warning');
      expect(result!.message).toBe('warnings.bisectInProgress');
    });

    it('should return null when no bisect in progress', async () => {
      mockGitService.isBisectInProgress.mockResolvedValue(false);
      const result = await preventionService.checkBisectInProgress();
      expect(result).toBeNull();
    });
  });

  describe('checkRepoState', () => {
    it('should return all active state warnings', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(true);
      mockGitService.isRebaseInProgress.mockResolvedValue(false);
      mockGitService.isCherryPickInProgress.mockResolvedValue(true);
      mockGitService.isBisectInProgress.mockResolvedValue(false);

      const warnings = await preventionService.checkRepoState();
      expect(warnings).toHaveLength(2);
      expect(warnings[0].message).toBe('warnings.mergeInProgress');
      expect(warnings[1].message).toBe('warnings.cherryPickInProgress');
    });

    it('should return empty array when no active states', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(false);
      mockGitService.isRebaseInProgress.mockResolvedValue(false);
      mockGitService.isCherryPickInProgress.mockResolvedValue(false);
      mockGitService.isBisectInProgress.mockResolvedValue(false);

      const warnings = await preventionService.checkRepoState();
      expect(warnings).toHaveLength(0);
    });
  });

  describe('validateCheckout', () => {
    it('should be valid when no uncommitted changes', async () => {
      mockGitService.hasUncommittedChanges.mockResolvedValue(false);
      const result = await preventionService.validateCheckout('main');
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about uncommitted changes', async () => {
      mockGitService.hasUncommittedChanges.mockResolvedValue(true);
      const result = await preventionService.validateCheckout('main');
      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.canProceed).toBe(true); // warning, not critical
    });
  });

  describe('validatePush', () => {
    it('should be valid for normal push', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(false);
      const result = await preventionService.validatePush(false);
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it('should add force push warning', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(false);
      const result = await preventionService.validatePush(true);
      expect(result.warnings.some(w => w.message === 'warnings.forcePush')).toBe(true);
      expect(result.canProceed).toBe(true); // force=true overrides critical
    });

    it('should detect detached HEAD', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(true);
      const result = await preventionService.validatePush(false);
      expect(result.warnings.some(w => w.message === 'warnings.detachedHead')).toBe(true);
    });
  });

  describe('validateCommit', () => {
    it('should be valid when files are staged', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(false);
      mockGitService.getStagedFiles.mockResolvedValue(['file.ts']);
      const result = await preventionService.validateCommit();
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it('should not proceed when no files staged', async () => {
      mockGitService.isDetachedHead.mockResolvedValue(false);
      mockGitService.getStagedFiles.mockResolvedValue([]);
      const result = await preventionService.validateCommit();
      expect(result.valid).toBe(false);
      expect(result.canProceed).toBe(false);
    });
  });

  describe('validatePull', () => {
    it('should detect merge in progress', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(true);
      mockGitService.isRebaseInProgress.mockResolvedValue(false);
      mockGitService.hasUncommittedChanges.mockResolvedValue(false);
      mockGitService.hasRemote.mockResolvedValue(true);

      const result = await preventionService.validatePull();
      expect(result.canProceed).toBe(false);
      expect(result.warnings.some(w => w.message === 'warnings.mergeInProgress')).toBe(true);
    });

    it('should detect uncommitted changes as warning', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(false);
      mockGitService.isRebaseInProgress.mockResolvedValue(false);
      mockGitService.hasUncommittedChanges.mockResolvedValue(true);
      mockGitService.hasRemote.mockResolvedValue(true);

      const result = await preventionService.validatePull();
      expect(result.warnings.some(w => w.level === 'warning')).toBe(true);
    });

    it('should detect no remote', async () => {
      mockGitService.isMergeInProgress.mockResolvedValue(false);
      mockGitService.isRebaseInProgress.mockResolvedValue(false);
      mockGitService.hasUncommittedChanges.mockResolvedValue(false);
      mockGitService.hasRemote.mockResolvedValue(false);

      const result = await preventionService.validatePull();
      expect(result.warnings.some(w => w.message === 'warnings.noRemote')).toBe(true);
    });
  });

  describe('validateBranchDelete', () => {
    it('should prevent deleting current branch', async () => {
      mockGitService.getCurrentBranch.mockResolvedValue('main');
      const result = await preventionService.validateBranchDelete('main');
      expect(result.valid).toBe(false);
      expect(result.canProceed).toBe(false);
      expect(result.warnings[0].level).toBe('critical');
    });

    it('should allow deleting other branches', async () => {
      mockGitService.getCurrentBranch.mockResolvedValue('main');
      const result = await preventionService.validateBranchDelete('feature');
      expect(result.valid).toBe(true);
      expect(result.canProceed).toBe(true);
    });
  });

  describe('shouldConfirmAction', () => {
    it('should return config value', () => {
      expect(preventionService.shouldConfirmAction()).toBe(true);
    });
  });
});
