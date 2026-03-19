const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = (req, res) => {
  let html;
  try {
    html = readFileSync(join(__dirname, '_blog.html'), 'utf8');
  } catch {
    html = readFileSync(join(process.cwd(), '_blog.html'), 'utf8');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(html);
};
