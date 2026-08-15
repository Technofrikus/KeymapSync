const defaultFs = require('fs');
const { parseConfig } = require('./config-validation');

function loadGeneratorConfig(configPath, { fs = defaultFs } = {}) {
  if (typeof configPath !== 'string' || !configPath.trim()) {
    throw new Error('A configuration file path is required.');
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found at ${configPath}`);
  }

  if (!fs.statSync(configPath).isFile()) {
    throw new Error(`Config path is not a file: ${configPath}`);
  }

  try {
    return parseConfig(fs.readFileSync(configPath, 'utf8'), configPath);
  } catch (err) {
    if (err && err.name === 'ConfigValidationError') throw err;
    throw new Error(`Could not read config at ${configPath}: ${err.message}`);
  }
}

module.exports = { loadGeneratorConfig, parseConfig };
