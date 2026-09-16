import type { Mocked, MockedFunction } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Behaviour tests for the real setup menu: the first thing a new user sees.
 *
 * Replaces test/integration/setup-flow.test.ts, which drove a mock git service
 * and asserted the mock had been called. Fourteen tests, no production line
 * executed.
 *
 * Two things here are worth pinning down. The .gitignore writer replaces a
 * file outright, so it has to ask when one already exists — and it writes to
 * process.cwd(), which is why these tests move the working directory into a
 * temporary one rather than mocking fs. And ensureGitIdentity is the guard in
 * front of every first commit: without it git fails with "Please tell me who
 * you are", which is where beginners give up.
 */

vi.mock('../../src/i18n/index.js', async () =>
  (await import('../helpers/module-mocks.js')).i18nMock());

vi.mock('../../src/utils/logger.js', async () =>
  (await import('../helpers/module-mocks.js')).loggerMock());

vi.mock('../../src/ui/themes/index.js', async () =>
  (await import('../helpers/module-mocks.js')).themeMock());

vi.mock('../../src/ui/components/box.js', async () =>
  (await import('../helpers/module-mocks.js')).boxMock());

vi.mock('../../src/ui/components/prompt.js', async () =>
  (await import('../helpers/module-mocks.js')).promptMock());

vi.mock('../../src/utils/error-mapper.js', async () =>
  (await import('../helpers/module-mocks.js')).errorMapperMock());

vi.mock('../../src/services/git-service.js', () => ({
  gitService: {
    init: vi.fn(),
    addRemote: vi.fn(),
    clone: vi.fn(),
    getUserIdentity: vi.fn(),
    setUserIdentity: vi.fn()
  }
}));

import {
  showSetupMenu,
  handleGitInit,
  handleGitClone,
  ensureGitIdentity
} from '../../src/ui/menus/setup-menu.js';
import { gitService } from '../../src/services/git-service.js';
import { promptSelect, promptConfirm, promptInput } from '../../src/ui/components/prompt.js';
import { GITIGNORE_TEMPLATES } from '../../src/utils/gitignore.js';

const git = gitService as Mocked<typeof gitService>;
const select = promptSelect as MockedFunction<typeof promptSelect>;
const confirm = promptConfirm as MockedFunction<typeof promptConfirm>;
const input = promptInput as MockedFunction<typeof promptInput>;

let workdir: string;
let originalCwd: string;

const gitignore = () => join(workdir, '.gitignore');

describe('Setup menu', () => {
  beforeEach(() => {
    // createGitignoreFile writes to process.cwd(); move it somewhere disposable
    // rather than mock fs, so the file that lands is the file being asserted on.
    originalCwd = process.cwd();
    workdir = mkdtempSync(join(tmpdir(), 'gitcoach-setup-'));
    process.chdir(workdir);

    vi.resetAllMocks();
    git.getUserIdentity.mockResolvedValue({ name: 'Someone', email: 'someone@example.com' });
    confirm.mockResolvedValue(false);
    input.mockResolvedValue('');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workdir, { recursive: true, force: true });
  });

  describe('the menu itself', () => {
    it('should offer init, clone and quit', async () => {
      select.mockResolvedValue('quit' as never);

      await showSetupMenu();

      const offered = (select.mock.calls[0][1] as { value: string }[]).map(c => c.value);
      expect(offered).toEqual(['init', 'clone', 'quit']);
    });

    it('should return what the user chose', async () => {
      select.mockResolvedValue('clone' as never);

      await expect(showSetupMenu()).resolves.toBe('clone');
    });
  });

  describe('git init', () => {
    it('should initialise the repository', async () => {
      await expect(handleGitInit()).resolves.toBe(true);

      expect(git.init).toHaveBeenCalledTimes(1);
    });

    it('should not add a remote when the user declines', async () => {
      confirm.mockResolvedValue(false);

      await handleGitInit();

      expect(git.addRemote).not.toHaveBeenCalled();
    });

    it('should add the remote the user gives', async () => {
      confirm.mockResolvedValueOnce(true).mockResolvedValue(false);
      input.mockResolvedValue('https://github.com/user/repo.git');

      await handleGitInit();

      expect(git.addRemote).toHaveBeenCalledWith('origin', 'https://github.com/user/repo.git');
    });

    it('should reject an invalid remote url through the prompt validator', async () => {
      confirm.mockResolvedValueOnce(true).mockResolvedValue(false);
      input.mockResolvedValue('https://github.com/user/repo.git');

      await handleGitInit();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('https://github.com/user/repo.git')).toBe(true);
      expect(validate('  ')).not.toBe(true);
      expect(validate('not a url')).not.toBe(true);
    });

    it('should report failure rather than throw when init fails', async () => {
      git.init.mockRejectedValue(new Error('permission denied'));

      await expect(handleGitInit()).resolves.toBe(false);
    });
  });

  describe('the .gitignore offered during init', () => {
    it('should write nothing when the user declines', async () => {
      confirm.mockResolvedValue(false);

      await handleGitInit();

      expect(existsSync(gitignore())).toBe(false);
    });

    it('should write the template the user picked', async () => {
      confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      select.mockResolvedValue('python' as never);

      await handleGitInit();

      expect(readFileSync(gitignore(), 'utf-8')).toBe(GITIGNORE_TEMPLATES.python);
    });

    it('should fall back to the generic template for an unknown choice', async () => {
      confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      select.mockResolvedValue('cobol' as never);

      await handleGitInit();

      expect(readFileSync(gitignore(), 'utf-8')).toBe(GITIGNORE_TEMPLATES.generic);
    });

    it('should ask before replacing a .gitignore that already exists', async () => {
      writeFileSync(gitignore(), '# mine\ndist/\n', 'utf-8');
      confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValue(false);
      select.mockResolvedValue('node' as never);

      await handleGitInit();

      // The existing file survives, because the overwrite question was declined.
      expect(readFileSync(gitignore(), 'utf-8')).toBe('# mine\ndist/\n');
    });

    it('should replace it when the user says so', async () => {
      writeFileSync(gitignore(), '# mine\n', 'utf-8');
      confirm.mockResolvedValueOnce(false).mockResolvedValue(true);
      select.mockResolvedValue('node' as never);

      await handleGitInit();

      expect(readFileSync(gitignore(), 'utf-8')).toBe(GITIGNORE_TEMPLATES.node);
    });
  });

  describe('git clone', () => {
    it('should clone the url the user gives', async () => {
      input.mockResolvedValueOnce('https://github.com/user/repo.git').mockResolvedValue('');

      await expect(handleGitClone()).resolves.toBe(true);

      expect(git.clone).toHaveBeenCalledWith('https://github.com/user/repo.git', undefined);
    });

    it('should pass the directory name when one is given', async () => {
      input
        .mockResolvedValueOnce('https://github.com/user/repo.git')
        .mockResolvedValueOnce('my-copy');

      await handleGitClone();

      expect(git.clone).toHaveBeenCalledWith('https://github.com/user/repo.git', 'my-copy');
    });

    it('should reject an empty or malformed url through the validator', async () => {
      input.mockResolvedValueOnce('https://github.com/user/repo.git').mockResolvedValue('');

      await handleGitClone();

      const validate = input.mock.calls[0][2] as (value: string) => string | true;
      expect(validate('https://github.com/user/repo.git')).toBe(true);
      expect(validate('   ')).not.toBe(true);
    });

    it('should report failure rather than throw when the clone fails', async () => {
      input.mockResolvedValueOnce('https://github.com/user/repo.git').mockResolvedValue('');
      git.clone.mockRejectedValue(new Error('repository not found'));

      await expect(handleGitClone()).resolves.toBe(false);
    });
  });

  describe('ensureGitIdentity', () => {
    it('should ask nothing when an identity is already configured', async () => {
      await expect(ensureGitIdentity()).resolves.toBe(true);

      expect(input).not.toHaveBeenCalled();
      expect(git.setUserIdentity).not.toHaveBeenCalled();
    });

    it('should ask for both parts when neither is set', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValueOnce('Ada').mockResolvedValueOnce('ada@example.com');

      await expect(ensureGitIdentity()).resolves.toBe(true);

      expect(git.setUserIdentity).toHaveBeenCalledWith('Ada', 'ada@example.com', false);
    });

    it('should ask again when only one half is set', async () => {
      git.getUserIdentity.mockResolvedValue({ name: 'Ada', email: null });
      input.mockResolvedValueOnce('Ada').mockResolvedValueOnce('ada@example.com');

      await ensureGitIdentity();

      expect(git.setUserIdentity).toHaveBeenCalled();
    });

    it('should write to the global config when asked to', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValueOnce('Ada').mockResolvedValueOnce('ada@example.com');

      await ensureGitIdentity('global');

      expect(git.setUserIdentity).toHaveBeenCalledWith('Ada', 'ada@example.com', true);
    });

    it('should give up when the name is left empty', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValue('');

      await expect(ensureGitIdentity()).resolves.toBe(false);
      expect(git.setUserIdentity).not.toHaveBeenCalled();
    });

    it('should give up when the email is left empty', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValueOnce('Ada').mockResolvedValueOnce('');

      await expect(ensureGitIdentity()).resolves.toBe(false);
      expect(git.setUserIdentity).not.toHaveBeenCalled();
    });

    it('should trim both values before storing them', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValueOnce('  Ada  ').mockResolvedValueOnce('  ada@example.com  ');

      await ensureGitIdentity();

      expect(git.setUserIdentity).toHaveBeenCalledWith('Ada', 'ada@example.com', false);
    });

    it('should reject an address that is not one, through the validator', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValueOnce('Ada').mockResolvedValueOnce('ada@example.com');

      await ensureGitIdentity();

      const validateName = input.mock.calls[0][2] as (value: string) => string | true;
      const validateEmail = input.mock.calls[1][2] as (value: string) => string | true;

      expect(validateName('Ada')).toBe(true);
      expect(validateName('   ')).not.toBe(true);

      expect(validateEmail('ada@example.com')).toBe(true);
      expect(validateEmail('ada')).not.toBe(true);
      expect(validateEmail('ada@example')).not.toBe(true);
      expect(validateEmail('ada @example.com')).not.toBe(true);
    });

    it('should report failure rather than throw when git refuses the write', async () => {
      git.getUserIdentity.mockResolvedValue({ name: null, email: null });
      input.mockResolvedValueOnce('Ada').mockResolvedValueOnce('ada@example.com');
      git.setUserIdentity.mockRejectedValue(new Error('config is read-only'));

      await expect(ensureGitIdentity()).resolves.toBe(false);
    });
  });
});
