import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const MENUS_DIR = path.join(__dirname, '../../src/ui/menus');

describe('Menu Labels - Level Adaptation', () => {
  it('main-menu.ts should use getMenuLabel for level-based labels', () => {
    const content = fs.readFileSync(path.join(MENUS_DIR, 'main-menu.ts'), 'utf-8');
    expect(content).toContain('getMenuLabel');
    expect(content).toContain("import { getLevel }");
  });

  it('main-menu.ts should have labels for all main actions', () => {
    const content = fs.readFileSync(path.join(MENUS_DIR, 'main-menu.ts'), 'utf-8');
    const actions = ['status', 'add', 'commit', 'push', 'pull', 'branch', 'stash', 'undo', 'history'];

    actions.forEach(action => {
      expect(content.toLowerCase()).toContain(action);
    });
  });
});
