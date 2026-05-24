const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

test('background preserves hosted checkout pool failure bookkeeping fields', () => {
  const source = readRepoFile('background.js');

  assert.match(source, /case 'hostedCheckoutSmsPoolUsage':/);
  assert.match(source, /failureCount/);
  assert.match(source, /disabled:/);
  assert.match(source, /disabledAt/);
  assert.match(source, /disabledReason/);
});

test('PayPal hosted checkout pool selection skips disabled entries and prefers fewer failures', () => {
  const source = readRepoFile('background', 'steps', 'create-plus-checkout.js');

  assert.match(source, /chooseHostedCheckoutSmsPoolEntry\(entries = \[], usage = \{\}\)/);
  assert.match(source, /normalizedUsage\[entry\.key\]\?\.disabled/);
  assert.match(source, /failureCount/);
  assert.match(source, /useCount/);
  assert.match(source, /usedAt/);
});

test('PayPal hosted checkout pool usage updates record failures and disable entries at threshold', () => {
  const source = readRepoFile('background', 'steps', 'create-plus-checkout.js');

  assert.match(source, /HOSTED_CHECKOUT_SMS_POOL_FAILURE_DISABLE_THRESHOLD/);
  assert.match(source, /failureCount/);
  assert.match(source, /lastFailureAt/);
  assert.match(source, /disabledAt/);
  assert.match(source, /disabledReason/);
});

test('sidepanel shows disabled PayPal pool entries and failure counts', () => {
  const source = readRepoFile('sidepanel', 'hosted-sms-pool-manager.js');
  const html = readRepoFile('sidepanel', 'sidepanel.html');

  assert.match(source, /failureCount/);
  assert.match(source, /disabled/);
  assert.match(html, /id="row-hosted-checkout-sms-pool"/);
  assert.match(html, /<option\s+value="disabled">已禁用<\/option>/);
});
