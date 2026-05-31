#!/usr/bin/env node
import { main } from '../dist/cli.js';

main(process.argv.slice(2)).catch((error) => {
  console.error(`[monkeys-memory] ${error.message}`);
  process.exit(1);
});
