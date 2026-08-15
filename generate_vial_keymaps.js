#!/usr/bin/env node

/**
 * Command-line adapter for the Keymap State transformation module.
 * The implementation lives in gui-electron/generate_vial_keymaps.js so the
 * desktop app and CLI always use the same transform and `.vil` persistence.
 */

const fs = require('fs');
const path = require('path');
const transformation = require('./gui-electron/generate_vial_keymaps.js');
const { parseConfig } = require('./gui-electron/config-validation.js');

const ROOT = __dirname;
const INPUT_DIR = path.join(ROOT, 'original');
const OUTPUT_DIR = path.join(ROOT, 'output');
const CONFIG_PATH = path.join(ROOT, 'alpha_layers.json');

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found at ${CONFIG_PATH}`);
  }

  const config = parseConfig(fs.readFileSync(CONFIG_PATH, 'utf8'), CONFIG_PATH);
  const { results, warnings } = await transformation.transformVilDirectory({
    inputDir: INPUT_DIR,
    outputDir: OUTPUT_DIR,
    config,
  });

  results.forEach(({ inputPath, outputPath }) => {
    console.log(`Processed: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
  });
  warnings.forEach((warning) => console.warn(`Untranslated symbol: ${warning}`));
  return { results, warnings };
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ...transformation, main };
