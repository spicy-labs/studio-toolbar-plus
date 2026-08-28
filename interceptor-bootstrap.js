// Standalone fetch interceptor — injected at document_start (main world)
// to patch fetch before Studio loads and calls /settings.
// Mirrors the logic in src/utils/studioVersionInterceptor.ts and
// src/utils/studioVersion.ts but has no imports so it can run standalone.
// State is published on window.__studioVersionInterceptorState so the toolbar
// bundle — which loads far too late to install its own patch — can read what
// this actually did.
(function () {
  if (window.__studioVersionInterceptorInstalled) return;
  window.__studioVersionInterceptorInstalled = true;

  var PREFIX = "studio_version_override_";
  var origFetch = window.fetch.bind(window);

  var state = window.__studioVersionInterceptorState || {
    appliedOverride: null,
    observedDefaults: {},
    bootSettingsCallSeen: false,
    output: { injected: 0, skipped: 0, lastEngineVersion: null },
  };
  window.__studioVersionInterceptorState = state;

  function getEnvFromSettingsUrl(url) {
    var m = url.match(/\/grafx\/api\/v1\/environment\/([^/]+)\/settings/);
    return m ? m[1] : null;
  }

  // "/output/settings/png" is a different endpoint and must not match.
  function getEnvFromOutputUrl(url) {
    var m = url.match(
      /\/grafx\/api\/v1\/environment\/([^/]+)\/output\/(?:jpg|png|mp4|gif|pdf|html)\/?(?:[?#]|$)/,
    );
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

  // Overwrite: an override is an explicit user instruction, so it wins over
  // whatever the app put in the body. Returns null when there is nothing to
  // rewrite.
  function withEngineVersion(bodyText, engineVersion) {
    try {
      var parsed = JSON.parse(bodyText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      parsed.engineVersion = engineVersion;
      return JSON.stringify(parsed);
    } catch (e) {
      return null;
    }
  }

  function extractUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  }

  function extractMethod(input, init) {
    if (init && init.method) return init.method;
    if (input instanceof Request) return input.method;
    return "GET";
  }

  // Resolves to [input, init] — unchanged on anything unexpected, so a failed
  // rewrite can never fail the export itself.
  function applyEngineVersion(input, init, engineVersion) {
    try {
      if (init && typeof init.body === "string") {
        var body = withEngineVersion(init.body, engineVersion);
        if (body === null) {
          state.output.skipped += 1;
          return Promise.resolve([input, init]);
        }
        var nextInit = Object.assign({}, init, { body: body });
        state.output.injected += 1;
        state.output.lastEngineVersion = engineVersion;
        return Promise.resolve([input, nextInit]);
      }

      if (input instanceof Request && (!init || init.body == null)) {
        return input
          .clone()
          .text()
          .then(function (text) {
            var reqBody = withEngineVersion(text, engineVersion);
            if (reqBody === null) {
              state.output.skipped += 1;
              return [input, init];
            }
            var rewritten = new Request(input, { body: reqBody });
            state.output.injected += 1;
            state.output.lastEngineVersion = engineVersion;
            return [rewritten, init];
          })
          .catch(function () {
            state.output.skipped += 1;
            return [input, init];
          });
      }
    } catch (e) {
      // fall through to the skip below
    }

    state.output.skipped += 1;
    return Promise.resolve([input, init]);
  }

  function interceptResponse(input, response) {
    var url = extractUrl(input);
    var envId = getEnvFromSettingsUrl(url);
    if (!envId || !response.ok) return Promise.resolve(response);

    var isBootSettingsCall = !state.bootSettingsCallSeen;
    state.bootSettingsCallSeen = true;

    var override = getOverride(envId);
    if (!override) return Promise.resolve(response);

    var cloned = response.clone();
    return cloned
      .json()
      .then(function (data) {
        if (data && typeof data === "object" && "sdkVersionPublic" in data) {
          if (typeof data.sdkVersionPublic === "string") {
            state.observedDefaults[envId] = data.sdkVersionPublic;
          }
          data.sdkVersionPublic = toPublicVersion(override.sdkVersion);
          var headers = new Headers(response.headers);
          headers.set("content-type", "application/json");
          if (isBootSettingsCall) {
            state.appliedOverride = {
              envId: envId,
              sdkVersion: override.sdkVersion,
              engineVersion: override.engineVersion,
              expiresAt: override.expiresAt,
            };
          }
          return new Response(JSON.stringify(data), {
            status: response.status,
            statusText: response.statusText,
            headers: headers,
          });
        }
        return response;
      })
      .catch(function () {
        return response;
      });
  }

  function send(input, init) {
    return origFetch(input, init).then(function (response) {
      return interceptResponse(input, response);
    });
  }

  window.fetch = function (input, init) {
    var outputEnvId = getEnvFromOutputUrl(extractUrl(input));
    if (!outputEnvId || extractMethod(input, init).toUpperCase() !== "POST") {
      // Fast path: everything that is not an output request starts the network
      // call synchronously, exactly as an unpatched fetch would.
      return send(input, init);
    }

    // Gate on the boot snapshot, never on storage. localStorage is shared across
    // tabs: a tab that booted clean must keep exporting on the default engine
    // even while another tab holds an override, or its export would silently
    // diverge from the preview it is showing — with no banner, since that tab
    // has no snapshot. For the same reason the engine we send is the one this
    // tab is running, not whatever storage currently says.
    var snapshot = state.appliedOverride;
    if (
      !snapshot ||
      !snapshot.engineVersion ||
      snapshot.envId !== outputEnvId
    ) {
      return send(input, init);
    }

    return applyEngineVersion(input, init, snapshot.engineVersion).then(
      function (args) {
        return send(args[0], args[1]);
      },
    );
  };
})();
