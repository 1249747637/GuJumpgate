const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('background persisted mailProvider normalization preserves LuckMail', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const match = source.match(/case 'mailProvider':\s*\{([\s\S]*?)\n\s*\}\s*case 'mail2925Mode':/);

  assert.ok(match, 'mailProvider normalization block should be present');
  assert.match(match[1], /normalizedMailProvider === LUCKMAIL_PROVIDER/);
  assert.match(match[1], /return LUCKMAIL_PROVIDER/);
});
