#!/usr/bin/env npx tsx
/**
 * Product surfaces doctor entry.
 * Usage: npx tsx scripts/zavorth-surfaces-doctor.ts [--quick] [--json]
 */
import { runProductSurfacesDoctorCli } from '../src/cli/ProductSurfacesDoctorCli.js';

runProductSurfacesDoctorCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
