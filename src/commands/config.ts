import { Command } from '@oclif/core';
import { initI18n } from '../i18n/index.js';
import { showConfigMenu } from '../ui/menus/config-menu.js';

export default class Config extends Command {
  static override description = 'Configure GitCoach settings';

  static override examples = ['<%= config.bin %> config'];

  async run(): Promise<void> {
    await initI18n();
    await showConfigMenu();
  }
}
