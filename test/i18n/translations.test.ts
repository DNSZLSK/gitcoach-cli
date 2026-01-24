import { describe, it, expect } from '@jest/globals';
import en from '../../src/i18n/locales/en.json';
import fr from '../../src/i18n/locales/fr.json';
import es from '../../src/i18n/locales/es.json';

const getAllKeys = (obj: any, prefix = ''): string[] => {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getAllKeys(value, fullKey);
    }
    return [fullKey];
  });
};

describe('Translations Completeness', () => {
  const enKeys = getAllKeys(en);
  const frKeys = getAllKeys(fr);
  const esKeys = getAllKeys(es);

  it('all languages should have same number of keys', () => {
    expect(frKeys.length).toBe(enKeys.length);
    expect(esKeys.length).toBe(enKeys.length);
  });

  it('FR should have all EN keys', () => {
    const missing = enKeys.filter(k => !frKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('ES should have all EN keys', () => {
    const missing = enKeys.filter(k => !esKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('EN should not have extra keys not in FR', () => {
    const extra = enKeys.filter(k => !frKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it('EN should not have extra keys not in ES', () => {
    const extra = enKeys.filter(k => !esKeys.includes(k));
    expect(extra).toEqual([]);
  });
});

describe('Translations - No Empty Values', () => {
  const checkEmpty = (obj: any, prefix = ''): string[] => {
    return Object.entries(obj).flatMap(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string' && value.trim() === '') {
        return [fullKey];
      } else if (typeof value === 'object' && value !== null) {
        return checkEmpty(value, fullKey);
      }
      return [];
    });
  };

  it('EN should not have empty values', () => {
    expect(checkEmpty(en)).toEqual([]);
  });

  it('FR should not have empty values', () => {
    expect(checkEmpty(fr)).toEqual([]);
  });

  it('ES should not have empty values', () => {
    expect(checkEmpty(es)).toEqual([]);
  });
});

describe('Translations - Level-specific keys', () => {
  const levelKeys = [
    'menu.statusBeginner', 'menu.statusIntermediate', 'menu.statusExpert',
    'menu.addBeginner', 'menu.addIntermediate', 'menu.addExpert',
    'menu.commitBeginner', 'menu.commitIntermediate', 'menu.commitExpert',
    'menu.pushBeginner', 'menu.pushIntermediate', 'menu.pushExpert',
    'menu.pullBeginner', 'menu.pullIntermediate', 'menu.pullExpert',
    'menu.branchBeginner', 'menu.branchIntermediate', 'menu.branchExpert',
  ];

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  };

  levelKeys.forEach(key => {
    it(`EN should have ${key}`, () => {
      expect(getNestedValue(en, key)).toBeDefined();
    });

    it(`FR should have ${key}`, () => {
      expect(getNestedValue(fr, key)).toBeDefined();
    });

    it(`ES should have ${key}`, () => {
      expect(getNestedValue(es, key)).toBeDefined();
    });
  });
});
