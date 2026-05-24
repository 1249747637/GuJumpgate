const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mailProviderUtils = require('../mail-provider-utils.js');
require('../shared/flow-capabilities.js');

test('mail provider utilities preserve LuckMail provider selection', () => {
  assert.equal(mailProviderUtils.normalizeMailProvider('luckmail-api'), 'luckmail-api');

  const config = mailProviderUtils.getMailProviderConfig({ mailProvider: 'luckmail-api' });
  assert.equal(config.provider, 'luckmail-api');
  assert.equal(config.label, 'LuckMail（API 购邮）');
});

test('sidepanel exposes LuckMail in the mail provider selector', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');
  assert.match(html, /<option\s+value="luckmail-api">LuckMail（API 购邮）<\/option>/);
});

test('sidepanel exposes all supported mail providers in the provider selector', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');
  const selectMatch = html.match(/<select id="select-mail-provider" class="data-select">([\s\S]*?)<\/select>/);
  assert.ok(selectMatch, 'mail provider select should exist');
  const providerSectionValues = Array.from(
    selectMatch[1].matchAll(/<option\s+value="([^"]+)">/g),
    (match) => match[1]
  );
  assert.deepEqual(providerSectionValues, [
    'hotmail-api',
    'luckmail-api',
    'cloudflare-temp-email',
    'cloudmail',
    'qq',
    '163',
    '163-vip',
    '126',
    'gmail',
    'icloud',
    'inbucket',
    '2925',
    'custom',
  ]);
});

test('sidepanel normalizer preserves every supported mail provider', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');
  const match = source.match(/function normalizeSupportedMailProvider\(value = ''\) \{([\s\S]*?)\n\}/);

  assert.ok(match, 'normalizeSupportedMailProvider should exist');
  for (const provider of [
    'hotmail-api',
    'luckmail-api',
    'cloudflare-temp-email',
    'cloudmail',
    'qq',
    '163',
    '163-vip',
    '126',
    'gmail',
    'icloud',
    'inbucket',
    '2925',
    'custom',
  ]) {
    assert.match(
      match[1],
      new RegExp(`normalized === ${provider === 'hotmail-api'
        ? 'HOTMAIL_PROVIDER'
        : provider === 'luckmail-api'
          ? 'LUCKMAIL_PROVIDER'
          : provider === 'cloudflare-temp-email'
            ? 'CLOUDFLARE_TEMP_EMAIL_PROVIDER'
            : provider === 'cloudmail'
              ? 'CLOUD_MAIL_PROVIDER'
              : provider === 'gmail'
                ? 'GMAIL_PROVIDER'
                : provider === 'icloud'
                  ? 'ICLOUD_PROVIDER'
                  : `'${provider.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}'`
      }`),
      `normalizeSupportedMailProvider should preserve ${provider}`
    );
  }
});

test('codex flow capabilities allow LuckMail provider selection', () => {
  const registry = globalThis.MultiPageFlowCapabilities.createFlowCapabilityRegistry();
  const capabilities = registry.resolveSidepanelCapabilities({
    activeFlowId: 'codex',
    panelMode: 'local-cpa-json',
    state: {},
  });

  assert.equal(capabilities.canShowLuckmail, true);
});

test('unknown flow capabilities fall back to the default openai flow for LuckMail visibility', () => {
  const registry = globalThis.MultiPageFlowCapabilities.createFlowCapabilityRegistry();
  const capabilities = registry.resolveSidepanelCapabilities({
    activeFlowId: 'codex2api',
    panelMode: 'local-cpa-json',
    state: {},
  });

  assert.equal(capabilities.canShowLuckmail, true);
});
