#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Config } from '@oclif/core';

// Buffer to collect warnings during config load
let suppressWarnings = true;
let warningBuffer = [];

// Override stderr to suppress SINGLE_COMMAND_CLI warnings
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, ...args) => {
  const str = chunk.toString();
  if (suppressWarnings && (str.includes('Symbol(SINGLE_COMMAND_CLI)') || str.includes('ModuleLoadError'))) {
    warningBuffer.push(str);
    return true;
  }
  return originalStderrWrite(chunk, ...args);
};

// Override stdout to suppress warnings printed there too
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...args) => {
  const str = chunk.toString();
  if (suppressWarnings && (str.includes('Symbol(SINGLE_COMMAND_CLI)') || str.includes('ModuleLoadError'))) {
    warningBuffer.push(str);
    return true;
  }
  return originalStdoutWrite(chunk, ...args);
};

// Also suppress Node.js warnings
process.removeAllListeners('warning');
process.on('warning', () => {});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const config = await Config.load({ root: join(__dirname, '..') });

  // Re-enable output after config is loaded
  suppressWarnings = false;

  // Get args without node and script path
  const args = process.argv.slice(2);

  // Handle global flags
  if (args.includes('--help') || args.includes('-h')) {
    const { Help } = await import('@oclif/core');
    const help = new Help(config);
    await help.showHelp(args.filter(a => a !== '--help' && a !== '-h'));
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`gitsense/${config.version} ${process.platform}-${process.arch} node-${process.version}`);
    return;
  }

  // If no arguments provided, run the main menu (index command)
  if (args.length === 0) {
    // Dynamically import and run the Index command
    const { default: IndexCommand } = await import('../dist/commands/index.js');
    const cmd = new IndexCommand(args, config);
    await cmd.run();
  } else {
    // Otherwise, let oclif handle the command
    await config.runCommand(args[0], args.slice(1));
  }
}

main().catch((error) => {
  suppressWarnings = false;
  // Only show error if it's not the SINGLE_COMMAND_CLI warning
  if (!error.message?.includes('Symbol(SINGLE_COMMAND_CLI)')) {
    console.error(error);
  }
});
