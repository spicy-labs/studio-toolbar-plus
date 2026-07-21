// Standalone fetch interceptor — injected at document_start (main world)
// to patch fetch before Studio loads and calls /settings.
// Mirrors the logic in src/utils/studioVersionInterceptor.ts and
// src/utils/studioVersion.ts but has no imports so it can run standalone.
(function () {
  if (window.__studioVersionInterceptorInstalled) return;
  window.__studioVersionInterceptorInstalled = true;

  var PREFIX = "studio_version_override_";
  var origFetch = window.fetch.bind(window);

  function getEnvFromSettingsUrl(url) {
    var m = url.match(/\/grafx\/api\/v1\/environment\/([^/]+)\/settings/);
    return m ? m[1] : null;
  }

  function getOverride(envId) {
    try {
      var raw = localStorage.getItem(PREFIX + envId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed.sdkVersion || typeof parsed.expiresAt !== "number") return null;
      if (parsed.expiresAt < Date.now()) {
        localStorage.removeItem(PREFIX + envId);
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function toPublicVersion(full) {
    var parts = full.split(".");
    return parts.length >= 2 ? parts[0] + "." + parts[1] : full;
  }

  function extractUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  }

  window.fetch = function (input, init) {
    return origFetch(input, init).then(function (response) {
      var url = extractUrl(input);
      var envId = getEnvFromSettingsUrl(url);
      if (!envId || !response.ok) return response;
      var override = getOverride(envId);
      if (!override) return response;
      var cloned = response.clone();
      return cloned.json().then(function (data) {
        if (data && typeof data === "object" && "sdkVersionPublic" in data) {
          data.sdkVersionPublic = toPublicVersion(override.sdkVersion);
          var headers = new Headers(response.headers);
          headers.set("content-type", "application/json");
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: headers,
          });
        }
        return response;
      }).catch(function () {
        return response;
      });
    });
  };
})();
