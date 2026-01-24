import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const MENUS_DIR = path.join(__dirname, '../../src/ui/menus');

// Menus qui sont des points d'entree ou ont un flux special (pas besoin de back)
const EXEMPT_MENUS = [
  'main-menu.ts',      // Point d'entree principal, a 'quit' pour sortir
  'setup-menu.ts',     // Flux de configuration initial, obligatoire
  'detached-head-menu.ts' // Menu d'urgence, doit choisir une action
];

describe('Menu Navigation - Back Options', () => {
  const menuFiles = fs.readdirSync(MENUS_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');

  menuFiles.forEach(file => {
    it(`${file} should have back/quit/cancel/return option`, () => {
      const content = fs.readFileSync(path.join(MENUS_DIR, file), 'utf-8');
      const hasBackOption =
        content.includes("value: 'back'") ||
        content.includes("value: 'quit'") ||
        content.includes("value: 'cancel'") ||
        content.includes("value: 'return'") ||
        content.includes("value: 'ignore'") ||  // detached-head-menu uses ignore
        content.includes("'common.back'") ||
        content.includes("'common.quit'") ||
        content.includes("'menu.quit'");

      expect(hasBackOption).toBe(true);
    });
  });
});

describe('Menu Navigation - No Dead Ends', () => {
  const menuFiles = fs.readdirSync(MENUS_DIR).filter(f =>
    f.endsWith('.ts') && f !== 'index.ts' && !EXEMPT_MENUS.includes(f)
  );

  menuFiles.forEach(file => {
    it(`${file} should not have promptSelect without back option`, () => {
      const content = fs.readFileSync(path.join(MENUS_DIR, file), 'utf-8');

      // Si le menu utilise promptSelect ou checkbox, il doit avoir une option back
      const usesSelect = content.includes('promptSelect') || content.includes('checkbox');
      if (usesSelect) {
        const hasBackInChoices =
          content.includes("value: 'back'") ||
          content.includes("value: 'cancel'") ||
          content.includes("value: 'return'");
        expect(hasBackInChoices).toBe(true);
      }
    });
  });
});
