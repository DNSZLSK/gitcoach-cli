/**
 * CommonJS stub for @inquirer/prompts, which is pure ESM.
 *
 * Every prompt rejects rather than returning a value. A test that genuinely
 * drives the interface mocks src/ui/components/prompt.js and never reaches
 * this; anything that lands here is asking the user a question with no user
 * present, which would otherwise hang or silently take a default. Failing
 * loudly, and saying why, is the useful behaviour.
 */

const refuse = name => async () => {
  throw new Error(
    `${name}() was called in a test. Mock '../../src/ui/components/prompt.js' ` +
    'and drive the menu through it instead of prompting for real.'
  );
};

module.exports = {
  select: refuse('select'),
  input: refuse('input'),
  confirm: refuse('confirm'),
  checkbox: refuse('checkbox'),
  editor: refuse('editor'),
  password: refuse('password'),
  expand: refuse('expand'),
  rawlist: refuse('rawlist'),
  search: refuse('search'),
  number: refuse('number'),
  Separator: class Separator {
    constructor(line) {
      this.type = 'separator';
      this.line = line || '──────';
    }
  }
};
