const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

require('../background/clash-verge-controller.js');

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

function createFetchStub(responses, calls) {
  return async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: String(options.method || 'GET').toUpperCase(),
      headers: options.headers ? { ...options.headers } : {},
      body: options.body ?? null,
    });

    const response = responses.shift();
    if (!response) {
      throw new Error(`Unexpected request: ${url}`);
    }

    return {
      ok: response.ok !== false,
      status: response.status ?? 200,
      text: async () => (typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? {})),
    };
  };
}

test('clash verge controller rotates a manual group to the next proxy in order', async () => {
  const calls = [];
  const controller = globalThis.MultiPageBackgroundClashVergeController.createClashVergeController({
    fetchImpl: createFetchStub([
      {
        body: {
          name: '711链式手动选择',
          proxies: ['香港-1', '新加坡-1', '日本-1'],
          now: '香港-1',
        },
      },
      { body: { ok: true } },
    ], calls),
  });

  const result = await controller.rotateNextProxyInGroup({
    controllerUrl: 'http://127.0.0.1:9097',
    apiKey: 'set-your-secret',
    groupName: '711链式手动选择',
  });

  assert.equal(result.rotated, true);
  assert.equal(result.previousProxy, '香港-1');
  assert.equal(result.nextProxy, '新加坡-1');
  assert.equal(calls[0].method, 'GET');
  assert.match(calls[0].url, /\/group\/711%E9%93%BE%E5%BC%8F%E6%89%8B%E5%8A%A8%E9%80%89%E6%8B%A9$/);
  assert.equal(calls[1].method, 'PUT');
  assert.match(calls[1].url, /\/proxies\/711%E9%93%BE%E5%BC%8F%E6%89%8B%E5%8A%A8%E9%80%89%E6%8B%A9$/);
  assert.deepEqual(JSON.parse(calls[1].body), { name: '新加坡-1' });
  assert.equal(calls[1].headers.Authorization, 'Bearer set-your-secret');
});

test('clash verge controller wraps back to the first proxy after the last entry', async () => {
  const calls = [];
  const controller = globalThis.MultiPageBackgroundClashVergeController.createClashVergeController({
    fetchImpl: createFetchStub([
      {
        body: {
          proxies: ['香港-1', '新加坡-1', '日本-1'],
          now: '日本-1',
        },
      },
      { body: { ok: true } },
    ], calls),
  });

  const result = await controller.rotateNextProxyInGroup({
    controllerUrl: 'http://127.0.0.1:9097',
    apiKey: 'set-your-secret',
    groupName: '711链式手动选择',
  });

  assert.equal(result.rotated, true);
  assert.equal(result.nextProxy, '香港-1');
  assert.deepEqual(JSON.parse(calls[1].body), { name: '香港-1' });
});

test('clash verge controller leaves single-proxy groups untouched', async () => {
  const calls = [];
  const controller = globalThis.MultiPageBackgroundClashVergeController.createClashVergeController({
    fetchImpl: createFetchStub([
      {
        body: {
          proxies: ['香港-1'],
          now: '香港-1',
        },
      },
    ], calls),
  });

  const result = await controller.rotateNextProxyInGroup({
    controllerUrl: 'http://127.0.0.1:9097',
    apiKey: 'set-your-secret',
    groupName: '711链式手动选择',
  });

  assert.equal(result.rotated, false);
  assert.equal(result.reason, 'not_enough_proxies');
  assert.equal(calls.length, 1);
});

test('background wires clash verge rotation into auto-run round completion', () => {
  const source = readRepoFile('background.js');

  assert.match(source, /'background\/clash-verge-controller\.js'/);
  assert.match(source, /CLASH_VERGE_ROTATION_CONTROLLER_URL = 'http:\/\/127\.0\.0\.1:9097'/);
  assert.match(source, /CLASH_VERGE_ROTATION_API_KEY = 'set-your-secret'/);
  assert.match(source, /CLASH_VERGE_ROTATION_GROUP_NAME = '711链式手动选择'/);
  assert.match(source, /onAutoRunRoundComplete:\s*async/);
  assert.match(source, /rotateNextProxyInGroup\(\{/);
});
