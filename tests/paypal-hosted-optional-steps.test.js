const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

function loadStepDefinitions() {
  const source = readRepoFile('data', 'step-definitions.js');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageStepDefinitions;`)(globalScope);
}

function loadSourceRegistry() {
  const source = readRepoFile('shared', 'source-registry.js');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageSourceRegistry;`)(globalScope).createSourceRegistry();
}

test('PayPal hosted split steps are opt-in for sub2api plus oauth flow', () => {
  const api = loadStepDefinitions();
  const baseOptions = {
    panelMode: 'sub2api',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'oauth',
    signupMethod: 'email',
  };

  assert.deepStrictEqual(
    api.getNodeIds(baseOptions),
    [
      'open-chatgpt',
      'submit-signup-email',
      'fill-password',
      'fetch-signup-code',
      'fill-profile',
      'plus-checkout-create',
      'oauth-login',
      'fetch-login-code',
      'confirm-oauth',
      'platform-verify',
    ],
  );

  assert.deepStrictEqual(
    api.getNodeIds({
      ...baseOptions,
      paypalHostedSplitStepsEnabled: true,
    }),
    [
      'open-chatgpt',
      'submit-signup-email',
      'fill-password',
      'fetch-signup-code',
      'fill-profile',
      'plus-checkout-create',
      'paypal-hosted-email',
      'paypal-hosted-card',
      'paypal-hosted-create-account',
      'paypal-hosted-review',
      'oauth-login',
      'fetch-login-code',
      'confirm-oauth',
      'platform-verify',
    ],
  );
});

test('PayPal hosted split steps have source commands and background executors wired', () => {
  const registry = loadSourceRegistry();
  const background = readRepoFile('background.js');

  for (const command of [
    'paypal-hosted-email',
    'paypal-hosted-card',
    'paypal-hosted-create-account',
    'paypal-hosted-review',
  ]) {
    assert.equal(registry.driverAcceptsCommand('content/paypal-flow', command), true, `${command} should be accepted`);
    assert.match(background, new RegExp(`'${command}': \\(state\\) => plusCheckoutCreateExecutor\\.`));
  }
});

test('sidepanel exposes and persists optional PayPal hosted split steps setting', () => {
  const html = readRepoFile('sidepanel', 'sidepanel.html');
  const sidepanel = readRepoFile('sidepanel', 'sidepanel.js');
  const background = readRepoFile('background.js');

  assert.match(html, /id="input-paypal-hosted-split-steps-enabled"/);
  assert.match(html, />分段执行<\/span>/);
  assert.match(sidepanel, /const inputPayPalHostedSplitStepsEnabled = document\.getElementById\('input-paypal-hosted-split-steps-enabled'\);/);
  assert.match(sidepanel, /paypalHostedSplitStepsEnabled:\s*typeof inputPayPalHostedSplitStepsEnabled !== 'undefined'/);
  assert.match(sidepanel, /inputPayPalHostedSplitStepsEnabled\.checked = Boolean\(state\?\.paypalHostedSplitStepsEnabled\);/);
  assert.match(sidepanel, /inputPayPalHostedSplitStepsEnabled\?\.addEventListener\('change'/);
  assert.match(background, /paypalHostedSplitStepsEnabled:\s*false/);
  assert.match(background, /case 'paypalHostedSplitStepsEnabled':/);
  assert.match(background, /return Boolean\(value\);/);
});

test('sidepanel passes PayPal hosted split setting into workflow rebuilds', () => {
  const sidepanel = readRepoFile('sidepanel', 'sidepanel.js');

  assert.match(
    sidepanel,
    /stepDefinitions = getStepDefinitionsForMode\(currentPlusModeEnabled,[\s\S]*paypalHostedSplitStepsEnabled:\s*nextPayPalHostedSplitStepsEnabled/
  );
  assert.match(
    sidepanel,
    /getWorkflowNodesForMode\(currentPlusModeEnabled,[\s\S]*paypalHostedSplitStepsEnabled:\s*nextPayPalHostedSplitStepsEnabled/
  );
  assert.match(
    sidepanel,
    /syncStepDefinitionsForMode\(stepDefinitionState\.plusModeEnabled,[\s\S]*paypalHostedSplitStepsEnabled:\s*Boolean\(state\?\.paypalHostedSplitStepsEnabled\)/
  );
});

test('background uses a dynamic registry when PayPal hosted split steps are enabled', () => {
  const background = readRepoFile('background.js');

  assert.match(
    background,
    /if \(state\?\.paypalHostedSplitStepsEnabled[\s\S]*return buildStepRegistry\(getStepDefinitionsForState\(state\)\);/
  );
});
