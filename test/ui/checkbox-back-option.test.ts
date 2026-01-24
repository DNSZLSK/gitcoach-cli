import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const MENUS_DIR = path.join(__dirname, '../../src/ui/menus');

describe('Checkbox Selections - Back Option', () => {
  const menuFiles = fs.readdirSync(MENUS_DIR).filter(f => f.endsWith('.ts'));

  // Trouve les fichiers avec checkbox
  const checkboxFiles = menuFiles.filter(file => {
    const content = fs.readFileSync(path.join(MENUS_DIR, file), 'utf-8');
    return content.includes('promptCheckbox');
  });

  if (checkboxFiles.length === 0) {
    it('no checkbox menus found (test placeholder)', () => {
      expect(true).toBe(true);
    });
  } else {
    checkboxFiles.forEach(file => {
      it(`${file} with checkbox should have escape mechanism`, () => {
        const content = fs.readFileSync(path.join(MENUS_DIR, file), 'utf-8');
        // Checkbox peut avoir un back dans un menu parent, ou permettre selection vide
        const hasEscapeMechanism =
          content.includes("value: 'back'") ||
          content.includes("value: 'cancel'") ||
          content.includes("cancelled: true") ||
          content.includes("length === 0"); // Selection vide = annulation

        expect(hasEscapeMechanism).toBe(true);
      });
    });
  }
});
