#!/usr/bin/env node
import { main } from './lib/main.js';
import { UserError } from './lib/errors.js';
import { redact } from './lib/redact.js';

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code ?? 0;
  },
  (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(redact(err instanceof UserError ? message : err.stack || message));
    process.exitCode = 1;
  },
);
