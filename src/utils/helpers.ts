import spawn from 'cross-spawn';

const DEFAULT_COMMAND_TIMEOUT_MS = 30000;
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Execute an external program WITHOUT a shell, passing arguments as a list.
 *
 * This avoids shell interpolation/quoting entirely (no command injection, no
 * `%VAR%` expansion or quote-breakout on Windows cmd.exe). `cross-spawn` is used
 * so npm-installed `.cmd`/`.bat` shims (e.g. `copilot`, `npm`) launch correctly
 * on Windows without `shell: true`.
 *
 * Resolves with whatever stdout/stderr were captured even on a non-zero exit
 * (the Copilot CLI sometimes exits non-zero while still emitting a useful
 * answer); rejects only when the process cannot be spawned (e.g. ENOENT) or the
 * timeout elapses.
 */
export function executeFile(
  file: string,
  args: string[] = [],
  timeout: number = DEFAULT_COMMAND_TIMEOUT_MS
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_BUFFER_SIZE) {
        child.kill();
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: Error) => {
      finish(() => reject(error));
    });

    child.on('close', () => {
      finish(() => resolve({ stdout, stderr }));
    });
  });
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${plural || singular + 's'}`;
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function getRelativePath(absolutePath: string, basePath: string): string {
  if (absolutePath.startsWith(basePath)) {
    const relative = absolutePath.substring(basePath.length);
    return relative.startsWith('/') || relative.startsWith('\\')
      ? relative.substring(1)
      : relative;
  }
  return absolutePath;
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Whether the process is attached to an interactive terminal on both ends.
 * Interactive menus (Inquirer) hang or crash without a TTY, so callers should
 * bail out early when this is false (piped input, CI, etc.).
 */
export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && process.stdin.isTTY);
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function extractFirstLine(text: string): string {
  const newlineIndex = text.indexOf('\n');
  if (newlineIndex === -1) {
    return text;
  }
  return text.substring(0, newlineIndex);
}
