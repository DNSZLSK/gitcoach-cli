import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { t } from '../../i18n/index.js';
import { getTheme } from '../themes/index.js';
import { banner } from '../components/box.js';
import { promptSelect, promptConfirm, promptInput } from '../components/prompt.js';
import { gitService } from '../../services/git-service.js';
import { logger } from '../../utils/logger.js';

export type SetupMenuAction = 'init' | 'clone' | 'quit';

const GITIGNORE_TEMPLATES: Record<string, string> = {
  node: `# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build
dist/
build/
.next/

# Environment
.env
.env.local
.env*.local

# Logs
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`,
  python: `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
venv/
env/
.venv/

# Distribution / packaging
dist/
build/
*.egg-info/

# Environment
.env

# IDE
.idea/
.vscode/
*.swp

# Jupyter
.ipynb_checkpoints/

# OS
.DS_Store
Thumbs.db
`,
  java: `# Compiled class files
*.class

# Package files
*.jar
*.war
*.ear

# Build
target/
build/
out/

# IDE
.idea/
*.iml
.eclipse/
.settings/
.project
.classpath

# Logs
*.log

# OS
.DS_Store
Thumbs.db
`,
  generic: `# IDE
.idea/
.vscode/
*.swp
*.swo

# Environment
.env
.env.local

# Logs
*.log

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
out/
`
};

export async function showSetupMenu(): Promise<SetupMenuAction> {
  const theme = getTheme();

  // Show banner
  logger.raw(banner('1.0.0', t('app.tagline')));

  // Show message that this is not a git repo
  logger.raw(theme.warning(`  ${t('setup.notGitRepo')}\n`));

  const choices = [
    {
      name: theme.menuItem('I', `${t('setup.init')} - ${t('setup.initDesc')}`),
      value: 'init' as SetupMenuAction
    },
    {
      name: theme.menuItem('C', `${t('setup.clone')} - ${t('setup.cloneDesc')}`),
      value: 'clone' as SetupMenuAction
    },
    {
      name: theme.menuItem('Q', `${t('menu.quit')} - ${t('setup.quitDesc')}`),
      value: 'quit' as SetupMenuAction
    }
  ];

  return promptSelect(t('setup.menuTitle'), choices);
}

export async function handleGitInit(): Promise<boolean> {
  const theme = getTheme();

  logger.raw('\n' + theme.info(t('setup.initInProgress')));
  logger.command('git init');
  logger.raw('');

  try {
    // Execute git init
    await gitService.init();
    logger.raw(theme.success(t('setup.initSuccess')) + '\n');

    // Ask if user wants to add a remote
    const addRemote = await promptConfirm(t('setup.addRemoteQuestion'));

    if (addRemote) {
      const remoteUrl = await promptInput(
        t('setup.remoteUrlPrompt'),
        undefined,
        (input: string) => {
          if (!input.trim()) {
            return t('setup.remoteUrlRequired');
          }
          // Basic URL validation
          if (!input.includes('github.com') && !input.includes('gitlab.com') &&
              !input.includes('bitbucket.org') && !input.startsWith('git@') &&
              !input.startsWith('https://')) {
            return t('setup.remoteUrlInvalid');
          }
          return true;
        }
      );

      logger.command(`git remote add origin ${remoteUrl}`);
      await gitService.addRemote('origin', remoteUrl);
      logger.raw(theme.success(t('setup.remoteAdded', { url: remoteUrl })) + '\n');
    }

    // Ask if user wants to create .gitignore
    const createGitignore = await promptConfirm(t('setup.gitignoreQuestion'));

    if (createGitignore) {
      await createGitignoreFile();
    }

    logger.raw('\n' + theme.success(t('setup.repoReady')) + '\n');
    return true;
  } catch (error) {
    logger.raw(theme.error(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })) + '\n');
    return false;
  }
}

async function createGitignoreFile(): Promise<void> {
  const theme = getTheme();

  const choices = [
    { name: t('setup.gitignoreNode'), value: 'node' },
    { name: t('setup.gitignorePython'), value: 'python' },
    { name: t('setup.gitignoreJava'), value: 'java' },
    { name: t('setup.gitignoreGeneric'), value: 'generic' }
  ];

  const projectType = await promptSelect<string>(t('setup.gitignoreType'), choices);
  const template = GITIGNORE_TEMPLATES[projectType] || GITIGNORE_TEMPLATES.generic;

  const gitignorePath = join(process.cwd(), '.gitignore');

  // Check if .gitignore already exists
  if (existsSync(gitignorePath)) {
    const overwrite = await promptConfirm(t('setup.gitignoreOverwrite'));
    if (!overwrite) {
      return;
    }
  }

  writeFileSync(gitignorePath, template, 'utf-8');
  logger.raw(theme.success(t('setup.gitignoreCreated')) + '\n');
}

export async function handleGitClone(): Promise<boolean> {
  const theme = getTheme();

  try {
    const repoUrl = await promptInput(
      t('setup.cloneUrlPrompt'),
      undefined,
      (input: string) => {
        if (!input.trim()) {
          return t('setup.cloneUrlRequired');
        }
        return true;
      }
    );

    // Ask for directory name (optional)
    const dirName = await promptInput(t('setup.cloneDirPrompt'), '');

    logger.raw('\n' + theme.info(t('setup.cloneInProgress')));
    const cloneCmd = dirName ? `git clone ${repoUrl} ${dirName}` : `git clone ${repoUrl}`;
    logger.command(cloneCmd);
    logger.raw('');

    await gitService.clone(repoUrl, dirName || undefined);

    const targetDir = dirName || repoUrl.split('/').pop()?.replace('.git', '') || 'repository';
    logger.raw(theme.success(t('setup.cloneSuccess', { dir: targetDir })) + '\n');
    logger.raw(theme.info(t('setup.cloneNextStep', { dir: targetDir })) + '\n');

    return true;
  } catch (error) {
    logger.raw(theme.error(t('errors.generic', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })) + '\n');
    return false;
  }
}
