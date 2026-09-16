import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Reading and editing .gitignore.
 *
 * Kept apart from the menu so the file handling can be tested against a real
 * directory rather than through a prompt, and shared with the first-run setup,
 * which writes the same templates.
 *
 * Every function takes the repository root explicitly. Defaulting to
 * process.cwd() inside them would make the tests depend on where they are run
 * from, and the caller always knows the root anyway.
 */

export type GitignoreTemplate = 'node' | 'python' | 'java' | 'generic';

export const GITIGNORE_TEMPLATES: Record<GitignoreTemplate, string> = {
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

# Environment
.env
application-local.properties

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

export function gitignorePath(root: string): string {
  return join(root, '.gitignore');
}

export function hasGitignore(root: string): boolean {
  return existsSync(gitignorePath(root));
}

/** Raw contents, or an empty string when there is no .gitignore yet. */
export function readGitignore(root: string): string {
  const path = gitignorePath(root);
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

/**
 * The patterns the file actually applies: no comments, no blank lines.
 *
 * Whitespace is trimmed because git ignores trailing spaces in a pattern
 * unless they are escaped, and a pattern that differs from another only by an
 * invisible space would otherwise read as new and be appended twice.
 */
export function readPatterns(root: string): string[] {
  return readGitignore(root)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

export function hasPattern(root: string, pattern: string): boolean {
  return readPatterns(root).includes(pattern.trim());
}

/**
 * Append patterns that are not already there, and report which were added.
 *
 * Appending rather than rewriting matters: a .gitignore is often hand-edited
 * and grouped under comments, and replacing it would throw that away. The
 * existing content is left untouched apart from a newline if the file did not
 * end with one, since otherwise the first new pattern would be glued to the
 * last existing line.
 */
export function addPatterns(root: string, patterns: string[]): string[] {
  const existing = readPatterns(root);
  const seen = new Set(existing);
  const added: string[] = [];

  for (const raw of patterns) {
    const pattern = raw.trim();
    if (pattern.length === 0 || seen.has(pattern)) {
      continue;
    }
    seen.add(pattern);
    added.push(pattern);
  }

  if (added.length === 0) {
    return [];
  }

  const current = readGitignore(root);
  const separator = current.length === 0 || current.endsWith('\n') ? '' : '\n';
  writeFileSync(gitignorePath(root), current + separator + added.join('\n') + '\n', 'utf-8');

  return added;
}

/**
 * Remove every line matching a pattern, leaving comments and spacing alone.
 *
 * Returns false when the pattern was not there, so the caller can say so
 * rather than report a change that did not happen.
 */
export function removePattern(root: string, pattern: string): boolean {
  if (!hasGitignore(root)) {
    return false;
  }

  const target = pattern.trim();
  const lines = readGitignore(root).split(/\r?\n/);
  const kept = lines.filter(line => line.trim() !== target);

  if (kept.length === lines.length) {
    return false;
  }

  writeFileSync(gitignorePath(root), kept.join('\n'), 'utf-8');
  return true;
}

/**
 * Write a template, replacing whatever is there.
 *
 * The caller is responsible for asking first; unlike addPatterns this does
 * discard existing content.
 */
export function writeTemplate(root: string, template: GitignoreTemplate): void {
  writeFileSync(gitignorePath(root), GITIGNORE_TEMPLATES[template], 'utf-8');
}
