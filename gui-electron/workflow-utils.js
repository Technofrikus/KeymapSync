const defaultFs = require('fs');

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
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read config at ${configPath}: ${err.message}`);
  }
}

module.exports = { loadGeneratorConfig };
