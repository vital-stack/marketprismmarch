const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

/**
 * Resolve and read an HTML template file.
 * Tries multiple paths to handle Vercel's serverless file bundling.
 */
module.exports = function resolveTemplate(filename) {
  const candidates = [
    join(__dirname, filename),
    join(__dirname, '..', filename),
    join(process.cwd(), filename),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      return readFileSync(p, 'utf8');
    }
  }

  throw new Error('Template not found: ' + filename + '. Searched: ' + candidates.join(', '));
};
