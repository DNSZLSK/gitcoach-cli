import Table from 'cli-table3';
import { getTheme } from '../themes/index.js';
import { userConfig } from '../../config/user-config.js';

export interface TableOptions {
  head?: string[];
  colWidths?: number[];
  wordWrap?: boolean;
}

export function createTable(rows: string[][], options: TableOptions = {}): string {
  const isMonochrome = userConfig.getTheme() === 'monochrome';

  const tableOptions: Table.TableConstructorOptions = {
    wordWrap: options.wordWrap ?? true,
    style: {
      head: isMonochrome ? [] : ['cyan'],
      border: isMonochrome ? [] : ['gray']
    }
  };

  if (options.head) {
    tableOptions.head = options.head;
  }

  if (options.colWidths) {
    tableOptions.colWidths = options.colWidths;
  }

  const table = new Table(tableOptions);

  for (const row of rows) {
    table.push(row);
  }

  return table.toString();
}

export function statusTable(files: { name: string; status: string }[]): string {
  const theme = getTheme();

  const rows = files.map(f => {
    const statusDisplay = {
      staged: theme.staged('+'),
      modified: theme.modified('~'),
      deleted: theme.deleted('-'),
      untracked: theme.untracked('?')
    }[f.status] || f.status;

    return [statusDisplay, f.name];
  });

  return createTable(rows, {
    head: ['', 'File']
  });
}

export function branchTable(branches: { name: string; current: boolean; commit: string }[]): string {
  const theme = getTheme();

  const rows = branches.map(b => [
    theme.branchName(b.name, b.current),
    theme.commitHash(b.commit)
  ]);

  return createTable(rows, {
    head: ['Branch', 'Last Commit']
  });
}

export function statsTable(stats: { label: string; value: string | number }[]): string {
  const theme = getTheme();

  const rows = stats.map(s => [
    theme.textMuted(s.label),
    theme.textBold(String(s.value))
  ]);

  return createTable(rows, {
    colWidths: [25, 15]
  });
}

export function commitTable(commits: { hash: string; message: string; date: string }[]): string {
  const theme = getTheme();

  const rows = commits.map(c => [
    theme.commitHash(c.hash),
    c.message.substring(0, 50) + (c.message.length > 50 ? '...' : ''),
    theme.textMuted(c.date)
  ]);

  return createTable(rows, {
    head: ['Hash', 'Message', 'Date'],
    colWidths: [10, 55, 20]
  });
}
