(function attachBackgroundClashVergeController(root, factory) {
  const api = factory();
  root.MultiPageBackgroundClashVergeController = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundClashVergeControllerModule() {
  function normalizeBaseUrl(value = '') {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function normalizeName(value = '') {
    return String(value || '').trim();
  }

  function buildHeaders(apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const normalizedApiKey = normalizeName(apiKey);
    if (normalizedApiKey) {
      headers.Authorization = `Bearer ${normalizedApiKey}`;
      headers['X-API-Key'] = normalizedApiKey;
    }
    return headers;
  }

  async function readJsonResponse(response) {
    const rawText = await response.text();
    if (!rawText) {
      return {};
    }
    try {
      return JSON.parse(rawText);
    } catch {
      return { raw: rawText };
    }
  }

  function normalizeProxyEntry(entry) {
    if (typeof entry === 'string') {
      return normalizeName(entry);
    }
    if (!entry || typeof entry !== 'object') {
      return '';
    }
    return normalizeName(
      entry.name
      || entry.proxy
      || entry.id
      || entry.server
      || entry.title
      || entry.value
    );
  }

  function normalizeProxyList(payload = {}) {
    const rawList = Array.isArray(payload?.proxies)
      ? payload.proxies
      : (Array.isArray(payload?.all) ? payload.all : []);
    const proxies = [];
    for (const entry of rawList) {
      const name = normalizeProxyEntry(entry);
      if (!name || proxies.includes(name)) {
        continue;
      }
      proxies.push(name);
    }
    return proxies;
  }

  function resolveCurrentProxyName(payload = {}) {
    return normalizeName(
      payload?.now
      || payload?.current
      || payload?.selected
      || payload?.proxy
      || payload?.name
    );
  }

  function pickNextProxy(proxies = [], currentProxy = '') {
    const normalizedProxies = Array.isArray(proxies) ? proxies.map((item) => normalizeName(item)).filter(Boolean) : [];
    if (normalizedProxies.length < 2) {
      return {
        rotated: false,
        reason: 'not_enough_proxies',
        proxies: normalizedProxies,
        currentProxy: normalizeName(currentProxy),
        nextProxy: '',
      };
    }

    const currentName = normalizeName(currentProxy);
    const currentIndex = normalizedProxies.indexOf(currentName);
    const nextProxy = currentIndex >= 0
      ? normalizedProxies[(currentIndex + 1) % normalizedProxies.length]
      : normalizedProxies[0];

    return {
      rotated: Boolean(nextProxy),
      reason: nextProxy ? '' : 'not_enough_proxies',
      proxies: normalizedProxies,
      currentProxy: currentName,
      nextProxy,
    };
  }

  function buildControllerRequestUrl(controllerUrl, path) {
    const baseUrl = normalizeBaseUrl(controllerUrl);
    return baseUrl ? `${baseUrl}${path}` : '';
  }

  function createClashVergeController(deps = {}) {
    const fetchImpl = typeof deps.fetchImpl === 'function'
      ? deps.fetchImpl
      : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (typeof fetchImpl !== 'function') {
      throw new Error('缺少 fetch 实现，无法控制 Clash Verge。');
    }

    async function requestGroupInfo(controllerUrl, apiKey, groupName) {
      const encodedGroupName = encodeURIComponent(normalizeName(groupName));
      const headers = buildHeaders(apiKey);
      const requestPaths = [
        `/group/${encodedGroupName}`,
        `/proxies/${encodedGroupName}`,
      ];

      let lastError = null;
      for (const path of requestPaths) {
        const requestUrl = buildControllerRequestUrl(controllerUrl, path);
        if (!requestUrl) {
          continue;
        }

        const response = await fetchImpl(requestUrl, {
          method: 'GET',
          headers,
        });
        const payload = await readJsonResponse(response);
        if (response.ok) {
          return { response, payload, requestUrl };
        }

        lastError = {
          status: response.status,
          payload,
          requestUrl,
        };
      }

      return { error: lastError };
    }

    async function rotateNextProxyInGroup(options = {}) {
      const controllerUrl = normalizeBaseUrl(options.controllerUrl);
      const apiKey = normalizeName(options.apiKey);
      const groupName = normalizeName(options.groupName);

      if (!controllerUrl || !apiKey || !groupName) {
        return {
          rotated: false,
          reason: 'missing_config',
          controllerUrl,
          groupName,
          nextProxy: '',
        };
      }

      const groupResult = await requestGroupInfo(controllerUrl, apiKey, groupName);
      if (groupResult.error) {
        return {
          rotated: false,
          reason: 'group_lookup_failed',
          controllerUrl,
          groupName,
          error: groupResult.error,
          nextProxy: '',
        };
      }

      const proxies = normalizeProxyList(groupResult.payload);
      const currentProxy = resolveCurrentProxyName(groupResult.payload);
      const pickResult = pickNextProxy(proxies, currentProxy);
      if (!pickResult.rotated) {
        return {
          ...pickResult,
          controllerUrl,
          groupName,
        };
      }

      const encodedGroupName = encodeURIComponent(groupName);
      const requestUrl = buildControllerRequestUrl(controllerUrl, `/proxies/${encodedGroupName}`);
      const response = await fetchImpl(requestUrl, {
        method: 'PUT',
        headers: buildHeaders(apiKey),
        body: JSON.stringify({ name: pickResult.nextProxy }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        return {
          rotated: false,
          reason: 'proxy_update_failed',
          controllerUrl,
          groupName,
          currentProxy: pickResult.currentProxy,
          nextProxy: pickResult.nextProxy,
          proxies: pickResult.proxies,
          error: {
            status: response.status,
            payload,
            requestUrl,
          },
        };
      }

      return {
        rotated: true,
        reason: '',
        controllerUrl,
        groupName,
        currentProxy: pickResult.currentProxy,
        previousProxy: pickResult.currentProxy,
        nextProxy: pickResult.nextProxy,
        proxies: pickResult.proxies,
        response: payload,
      };
    }

    return {
      rotateNextProxyInGroup,
    };
  }

  return {
    createClashVergeController,
  };
});
