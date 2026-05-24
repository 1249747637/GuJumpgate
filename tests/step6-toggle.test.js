const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

test('sidepanel exposes a switch for choosing whether step 6 runs', () => {
  const html = readRepoFile('sidepanel', 'sidepanel.html');

  assert.match(html, /id="input-step6-enabled"/);
  assert.match(html, /for="input-step6-enabled"/);
  assert.match(html, />执行<\/span>/);
});

test('sidepanel persists and restores the step 6 run setting', () => {
  const source = readRepoFile('sidepanel', 'sidepanel.js');

  assert.match(source, /const inputStep6Enabled = document\.getElementById\('input-step6-enabled'\);/);
  assert.match(source, /step6Enabled:\s*typeof inputStep6Enabled !== 'undefined'/);
  assert.match(source, /inputStep6Enabled\.checked = state\?\.step6Enabled !== false;/);
  assert.match(source, /inputStep6Enabled\?\.addEventListener\('change'/);
  assert.match(source, /message\.payload\.step6Enabled !== undefined/);
});

test('background persists step 6 run setting with enabled default', () => {
  const source = readRepoFile('background.js');

  assert.match(source, /step6Enabled:\s*true/);
  assert.match(source, /case 'step6Enabled':/);
  assert.match(source, /return value !== false;/);
});

test('background skips the current flow step 6 node when disabled', () => {
  const source = readRepoFile('background.js');

  assert.match(source, /async function shouldSkipStep6NodeExecution\(nodeId, state = \{\}\)/);
  assert.match(source, /Number\(step\) === 6/);
  assert.match(source, /state\?\.step6Enabled === false/);
  assert.match(source, /await setNodeStatus\(normalizedNodeId, 'skipped'\);/);
  assert.match(source, /return;/);
});
