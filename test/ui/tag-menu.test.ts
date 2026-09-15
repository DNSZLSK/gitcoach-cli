/**
 * Behaviour tests for the real tag menu.
 *
 * Unlike the older UI suites, these import the menu module itself and drive it
 * through mocked prompts, then assert on the git calls it made. Asserting that
 * a mock recorded its own call proves nothing; what matters is that choosing
 * "delete" actually deletes, and that the remote is left alone unless asked.
 *
 * Everything that reaches a terminal (themes, boxes, logger) is stubbed,
 * because chalk and boxen ship ESM that Jest will not transform.
 */

jest.mock('../../src/i18n/index.js', () => ({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key
}));

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    raw: jest.fn(),
    command: jest.fn()
  }
}));

jest.mock('../../src/ui/themes/index.js', () => ({
  getTheme: () => new Proxy({}, {
    get: () => (value: string) => String(value)
  })
}));

jest.mock('../../src/ui/components/box.js', () => ({
  successBox: (text: string) => text,
  warningBox: (text: string) => text,
  infoBox: (text: string) => text,
  errorBox: (text: string) => text
}));

jest.mock('../../src/utils/error-mapper.js', () => ({
  mapGitError: (error: unknown) => String(error)
}));

jest.mock('../../src/utils/level-helper.js', () => ({
  shouldShowExplanation: () => false
}));

jest.mock('../../src/ui/components/prompt.js', () => ({
  promptSelect: jest.fn(),
  promptConfirm: jest.fn(),
  promptInput: jest.fn()
}));

jest.mock('../../src/services/git-service.js', () => ({
  gitService: {
    getTags: jest.fn(),
    tagExists: jest.fn(),
    createTag: jest.fn(),
    deleteTag: jest.fn(),
    deleteRemoteTag: jest.fn(),
    pushTag: jest.fn(),
    pushAllTags: jest.fn(),
    getUnpushedTags: jest.fn(),
    hasRemote: jest.fn()
  }
}));

import { showTagMenu } from '../../src/ui/menus/tag-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';
import { logger } from '../../src/utils/logger.js';

const git = gitService as jest.Mocked<typeof gitService>;
const select = promptSelect as jest.MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as jest.MockedFunction<typeof promptConfirm>;
const input = promptInput as jest.MockedFunction<typeof promptInput>;

const tag = (name: string, annotated = true) => ({
  name,
  annotated,
  commit: 'abc1234',
  message: `${name} release`,
  date: '2026-01-01'
});

/** Queue answers for consecutive promptSelect calls, then always "back". */
const answers = (...values: unknown[]) => {
  values.forEach(value => select.mockResolvedValueOnce(value as never));
  select.mockResolvedValue('back' as never);
};

describe('Tag menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    git.getTags.mockResolvedValue([tag('v1.0.0')]);
    git.tagExists.mockResolvedValue(false);
    git.hasRemote.mockResolvedValue(true);
    git.getUnpushedTags.mockResolvedValue([]);
    confirm.mockResolvedValue(false);
    input.mockResolvedValue('');
  });

  it('should leave the repository alone when the user goes back', async () => {
    answers('back');

    await showTagMenu();

    expect(git.createTag).not.toHaveBeenCalled();
    expect(git.deleteTag).not.toHaveBeenCalled();
    expect(git.pushTag).not.toHaveBeenCalled();
  });

  it('should not offer delete or push when there are no tags', async () => {
    git.getTags.mockResolvedValue([]);
    answers('back');

    await showTagMenu();

    const offered = (select.mock.calls[0][1] as { value: string }[]).map(choice => choice.value);
    expect(offered).toContain('create');
    expect(offered).not.toContain('delete');
    expect(offered).not.toContain('push');
  });

  describe('creating', () => {
    it('should create an annotated tag when a message is given', async () => {
      answers('create');
      input.mockResolvedValueOnce('v2.0.0').mockResolvedValueOnce('Second release');

      await showTagMenu();

      expect(git.createTag).toHaveBeenCalledWith('v2.0.0', 'Second release');
    });

    it('should create a lightweight tag when the message is left empty', async () => {
      answers('create');
      input.mockResolvedValueOnce('v2.0.0').mockResolvedValueOnce('');

      await showTagMenu();

      expect(git.createTag).toHaveBeenCalledWith('v2.0.0', undefined);
    });

    it('should refuse a name that already exists', async () => {
      git.tagExists.mockResolvedValue(true);
      answers('create');
      input.mockResolvedValueOnce('v1.0.0');

      await showTagMenu();

      expect(git.createTag).not.toHaveBeenCalled();
    });

    it('should abandon creation when no name is entered', async () => {
      answers('create');
      input.mockResolvedValueOnce('');

      await showTagMenu();

      expect(git.createTag).not.toHaveBeenCalled();
    });

    it('should offer to push the new tag and push it on yes', async () => {
      answers('create');
      input.mockResolvedValueOnce('v2.0.0').mockResolvedValueOnce('msg');
      confirm.mockResolvedValueOnce(true);

      await showTagMenu();

      expect(git.pushTag).toHaveBeenCalledWith('v2.0.0');
    });

    it('should not push the new tag when there is no remote', async () => {
      git.hasRemote.mockResolvedValue(false);
      answers('create');
      input.mockResolvedValueOnce('v2.0.0').mockResolvedValueOnce('msg');

      await showTagMenu();

      expect(git.createTag).toHaveBeenCalled();
      expect(git.pushTag).not.toHaveBeenCalled();
    });

    it('should echo the git command it runs', async () => {
      answers('create');
      input.mockResolvedValueOnce('v2.0.0').mockResolvedValueOnce('Second release');

      await showTagMenu();

      expect(logger.command).toHaveBeenCalledWith('git tag -a v2.0.0 -m "Second release"');
    });
  });

  describe('deleting', () => {
    it('should require confirmation before deleting', async () => {
      answers('delete', 'v1.0.0');
      confirm.mockResolvedValue(false);

      await showTagMenu();

      expect(git.deleteTag).not.toHaveBeenCalled();
    });

    it('should delete locally once confirmed', async () => {
      answers('delete', 'v1.0.0');
      confirm.mockResolvedValueOnce(true);
      git.getUnpushedTags.mockResolvedValue(['v1.0.0']);

      await showTagMenu();

      expect(git.deleteTag).toHaveBeenCalledWith('v1.0.0');
    });

    it('should not touch the remote for a tag that was never pushed', async () => {
      answers('delete', 'v1.0.0');
      confirm.mockResolvedValueOnce(true);
      // The tag is listed as unpushed, so it does not exist on the remote.
      git.getUnpushedTags.mockResolvedValue(['v1.0.0']);

      await showTagMenu();

      expect(git.deleteRemoteTag).not.toHaveBeenCalled();
    });

    it('should delete on the remote only after a separate confirmation', async () => {
      answers('delete', 'v1.0.0');
      // First confirm deletes locally, second agrees to the remote deletion.
      confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
      git.getUnpushedTags.mockResolvedValue([]);

      await showTagMenu();

      expect(git.deleteRemoteTag).toHaveBeenCalledWith('v1.0.0');
    });

    it('should keep the remote tag when the second confirmation is declined', async () => {
      answers('delete', 'v1.0.0');
      confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      git.getUnpushedTags.mockResolvedValue([]);

      await showTagMenu();

      expect(git.deleteTag).toHaveBeenCalled();
      expect(git.deleteRemoteTag).not.toHaveBeenCalled();
    });

    it('should do nothing when the user backs out of the tag list', async () => {
      answers('delete', '');

      await showTagMenu();

      expect(git.deleteTag).not.toHaveBeenCalled();
    });
  });

  describe('pushing', () => {
    it('should report when everything is already pushed', async () => {
      answers('push');
      git.getUnpushedTags.mockResolvedValue([]);

      await showTagMenu();

      expect(git.pushTag).not.toHaveBeenCalled();
      expect(git.pushAllTags).not.toHaveBeenCalled();
    });

    it('should push every tag when asked', async () => {
      answers('push', 'all');
      git.getUnpushedTags.mockResolvedValue(['v1.0.0', 'v2.0.0']);

      await showTagMenu();

      expect(git.pushAllTags).toHaveBeenCalled();
    });

    it('should push a single chosen tag', async () => {
      answers('push', 'one', 'v2.0.0');
      git.getUnpushedTags.mockResolvedValue(['v1.0.0', 'v2.0.0']);

      await showTagMenu();

      expect(git.pushTag).toHaveBeenCalledWith('v2.0.0');
      expect(git.pushAllTags).not.toHaveBeenCalled();
    });

    it('should refuse to push without a remote', async () => {
      git.hasRemote.mockResolvedValue(false);
      answers('push');

      await showTagMenu();

      expect(git.pushAllTags).not.toHaveBeenCalled();
      expect(git.getUnpushedTags).not.toHaveBeenCalled();
    });

    it('should stop rather than claim success when the remote is unreachable', async () => {
      answers('push');
      git.getUnpushedTags.mockRejectedValue(new Error('network down'));

      await showTagMenu();

      expect(git.pushAllTags).not.toHaveBeenCalled();
    });
  });
});
