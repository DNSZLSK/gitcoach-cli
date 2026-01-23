import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      timeout: 30000 // 30 second timeout
    });
    return result;
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
      const execError = error as { stdout: string; stderr: string };
      return { stdout: execError.stdout || '', stderr: execError.stderr || error.message };
    }
    throw error;
  }
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
