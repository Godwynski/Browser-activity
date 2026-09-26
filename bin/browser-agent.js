#!/usr/bin/env node

/**
 * Universal Browser Control Runtime — Executable CLI Binary
 */

import { CommandLineInterface } from '../src/cli/index.js';

CommandLineInterface.run(process.argv.slice(2)).catch((err) => {
  console.error('CLI Execution Error:', err.message);
  process.exit(1);
});
