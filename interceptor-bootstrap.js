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

  // Backstop so no UI failure (render error, Toolbar remount losing the
  // handler) can leave a held save pending forever and wedge the workspace.
  var SAVE_TIMEOUT_MS = 2 * 60 * 1000;

  // Stands in for a body we could not read as text: non-empty and not JSON, so
  // classifySave returns "unknown" and we fail closed.
  var UNREADABLE = "[unreadable]";

  var state = window.__studioVersionInterceptorState || {
    appliedOverride: null,
    observedDefaults: {},
    bootSettingsCallSeen: false,
    output: { injected: 0, skipped: 0, lastEngineVersion: null },
    // At most one held request, ever. Deny by default beyond that.
    pendingSave: null,
    save: { blocked: 0, forced: 0, observed: 0 },
    saveTimeoutMs: SAVE_TIMEOUT_MS,
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

  // -1 / 0 / 1 comparing "1.46"-style public SDK versions numerically, null when
  // either side is unparseable. Hand-copy of compareSdkPublic in
  // src/utils/studioVersion.ts — engine strings are inconsistent ("2.15" vs
  // "2.15.0"), SDK public keys are uniformly x.y, so we compare those.
  function compareSdkPublic(a, b) {
    function parse(v) {
      var parts = String(v == null ? "" : v).split(".");
      var major = parts[0];
      var minor = parts.length > 1 ? parts[1] : null;
      var majorNum = Number(major);
      var minorNum = minor == null ? 0 : Number(minor);
      if (!isFinite(majorNum) || !isFinite(minorNum)) return null;
      if (major === "" || major == null) return null;
      if (minor === "") return null;
      return [majorNum, minorNum];
    }
    var left = parse(a);
    var right = parse(b);
    if (!left || !right) return null;
    if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
    if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
    return 0;
  }

  // The four save routes. Anchored with `/?(?:[?#]|$)` so a sub-path can never
  // match (/templates/{id}/preview is a read-only render, not an update), and
  // the `(?!import` lookahead keeps /templates/import — which sits where an id
  // would — from reading as an update of a template named "import".
  var TEMPLATE_UPDATE_URL_RE =
    /\/grafx\/api\/v1\/environment\/([^/]+)\/templates\/(?!import(?:[/?#]|$))([^/]+)\/?(?:[?#]|$)/;
  var TEMPLATE_CREATE_URL_RE =
    /\/grafx\/api\/v1\/environment\/([^/]+)\/templates\/?(?:[?#]|$)/;
  var COMPONENT_UPDATE_URL_RE =
    /\/grafx\/api\/v1\/environment\/([^/]+)\/components\/(?!import(?:[/?#]|$))([^/]+)\/?(?:[?#]|$)/;
  var COMPONENT_CREATE_URL_RE =
    /\/grafx\/api\/v1\/environment\/([^/]+)\/components\/?(?:[?#]|$)/;

  function matchEnv(re, url) {
    var m = url.match(re);
    return m ? m[1] : null;
  }

  // method + path is a complete classification: there are no PATCH routes on
  // either resource. Returns null for everything else, which is the untouched
  // existing behaviour.
  function classifySaveRoute(method, url) {
    var envId;
    if (method === "PUT") {
      envId = matchEnv(TEMPLATE_UPDATE_URL_RE, url);
      if (envId) return { envId: envId, kind: "template", isCreate: false };
      envId = matchEnv(COMPONENT_UPDATE_URL_RE, url);
      if (envId) return { envId: envId, kind: "component", isCreate: false };
      return null;
    }
    if (method === "POST") {
      envId = matchEnv(TEMPLATE_CREATE_URL_RE, url);
      if (envId) return { envId: envId, kind: "template", isCreate: true };
      envId = matchEnv(COMPONENT_CREATE_URL_RE, url);
      if (envId) return { envId: envId, kind: "component", isCreate: true };
      return null;
    }
    return null;
  }

  // Does this body carry a document, or is it just a metadata edit? "unknown"
  // means BLOCK — we fail closed, because a false negative here is a silently
  // corrupted template while the UI claims it protected you.
  function classifySave(kind, bodyText) {
    // A rename can never carry a document: the backend rejects `?name=`
    // together with a body, so an absent body means metadata-only.
    if (bodyText == null || String(bodyText).trim() === "") return "rename";

    var parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {
      // Blob, gzip, FormData — anything non-empty we cannot read. Fail closed.
      return "unknown";
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "unknown";
    }

    if (kind === "template") {
      // The `||` is LOAD-BEARING — legacy documents carry one key without the
      // other (engine fixtures 0.0.25–0.1.3 have engineVersion only,
      // 0.2.0–0.2.4 have documentVersion only).
      if ("documentVersion" in parsed || "engineVersion" in parsed) {
        return "save";
      }
      return "unknown";
    }

    // Components discriminate on key presence alone: a rename omits `content`
    // entirely, so this survives the object-vs-string ambiguity in `content`.
    return "content" in parsed ? "save" : "rename";
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

  var nextSaveId = 0;
  var NOT_FORCED = { ok: false, status: 0 };

  // The platform's toast reads errorData.detail (useClientApiErrorHandling.ts),
  // so the `detail` key is mandatory — without it the user gets a bare
  // "Something went wrong" next to our modal.
  function conflictResponse(overrideVersion, defaultVersion) {
    var body = JSON.stringify({
      detail:
        "Save blocked by Studio Toolbar+ — this tab is running Studio " +
        overrideVersion +
        ", the environment default is " +
        (defaultVersion || "unknown") +
        ".",
    });
    return new Response(body, {
      status: 409,
      statusText: "Conflict",
      headers: { "content-type": "application/json" },
    });
  }

  // Settle-once. An abandoned promise never settles the platform's save thunk,
  // which permanently wedges the workspace (stuck spinner, File > Save disabled
  // until reload), so the first of force / cancel / timeout wins and the rest
  // are no-ops.
  function settleSave(entry) {
    if (!entry || entry.settled) return false;
    entry.settled = true;
    if (entry.timer != null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (state.pendingSave === entry) state.pendingSave = null;
    return true;
  }

  // Replays the ORIGINAL input/init — never a request reconstructed from
  // captured headers, which would lose auth. The body was read via
  // input.clone(), so the original Request is still unconsumed. Resolves with
  // the real Response so the platform can parse it: Save As reads the new
  // template id out of the body and router-navigates to it.
  // Returns a promise for {ok, status} describing how the replay went, so the
  // toolbar can report the real outcome. studioVersionInterceptor.ts awaits
  // this: returning a bare boolean would make `result.ok` undefined there and
  // every successful forced save would be reported to the user as a failure.
  // {ok: false, status: 0} means "did not run" — no matching held save, or the
  // replay rejected at the network level.
  function forceSave(id) {
    var entry = state.pendingSave;
    if (!entry || entry.id !== id) return Promise.resolve(NOT_FORCED);
    if (!settleSave(entry)) return Promise.resolve(NOT_FORCED);
    state.save.forced += 1;
    var replay = origFetch(entry.input, entry.init);
    // The caller's fetch settles on the replay itself — including a rejection,
    // which is a genuine network failure the platform should see.
    entry.resolve(replay);
    return replay.then(
      function (response) {
        return { ok: response.ok, status: response.status };
      },
      function () {
        return NOT_FORCED;
      },
    );
  }

  function cancelSave(id) {
    var entry = state.pendingSave;
    if (!entry || entry.id !== id) return false;
    if (!settleSave(entry)) return false;
    entry.resolve(
      conflictResponse(entry.overrideVersion, entry.defaultVersion),
    );
    return true;
  }

  state.forceSave = forceSave;
  state.cancelSave = cancelSave;

  function holdSave(input, init, route, overrideVersion, defaultVersion) {
    // Deny by default: no queue, no second modal, at most one held request.
    // The workspace does not serialise saves, so we cannot rely on the UI.
    if (state.pendingSave) {
      return Promise.resolve(
        conflictResponse(overrideVersion, defaultVersion),
      );
    }

    nextSaveId += 1;
    var entry = {
      // Strings, not numbers. The id crosses into the toolbar bundle via the
      // CustomEvent and comes back through forceSave/cancelSave, which compare
      // with ===; studioVersionInterceptor.ts types it as string, so a numeric
      // id would silently fail that comparison the moment anything on the React
      // side normalises it — and a failed match leaves the save held until the
      // timeout. It is an opaque token, never arithmetic.
      id: "save-" + nextSaveId,
      settled: false,
      resolve: null,
      input: input,
      init: init,
      kind: route.kind,
      isCreate: route.isCreate,
      overrideVersion: overrideVersion,
      defaultVersion: defaultVersion,
      timer: null,
    };

    var promise = new Promise(function (resolve) {
      entry.resolve = resolve;
    });

    state.pendingSave = entry;
    state.save.blocked += 1;

    var timeoutMs =
      typeof state.saveTimeoutMs === "number"
        ? state.saveTimeoutMs
        : SAVE_TIMEOUT_MS;
    entry.timer = setTimeout(function () {
      entry.timer = null;
      if (!settleSave(entry)) return;
      entry.resolve(
        conflictResponse(entry.overrideVersion, entry.defaultVersion),
      );
    }, timeoutMs);

    try {
      window.dispatchEvent(
        new CustomEvent("studioToolbarPlus:saveBlocked", {
          detail: {
            id: entry.id,
            kind: entry.kind,
            isCreate: entry.isCreate,
            overrideVersion: entry.overrideVersion,
            defaultVersion: entry.defaultVersion,
          },
        }),
      );
    } catch (e) {
      // A failed dispatch must not leave the request unsettled; the timeout
      // backstop still applies.
    }

    return promise;
  }

  // Returns null when the request should go out normally (the common case), or
  // a promise that stands in for the request when it is held.
  function saveGate(input, init, route) {
    state.save.observed += 1;

    // Gate on the boot snapshot existing, NOT on the request env matching it: a
    // document authored on the override engine is dangerous wherever it is
    // written.
    var snapshot = state.appliedOverride;
    if (!snapshot || !snapshot.sdkVersion) return null;

    var overrideVersion = toPublicVersion(snapshot.sdkVersion);
    var defaultVersion = state.observedDefaults[snapshot.envId];
    var cmp = defaultVersion
      ? compareSdkPublic(overrideVersion, defaultVersion)
      : null;
    // Fail closed: block unless we can prove the override is at or below the
    // environment default. Downward overrides forward-migrate and are safe.
    if (defaultVersion && cmp !== null && cmp <= 0) return null;

    function decide(bodyText) {
      var verdict = classifySave(route.kind, bodyText);
      if (verdict === "rename") return null;
      return holdSave(input, init, route, overrideVersion, defaultVersion);
    }

    if (init && typeof init.body === "string") {
      return decide(init.body);
    }

    if (input instanceof Request && (!init || init.body == null)) {
      return input
        .clone()
        .text()
        .then(
          function (text) {
            return { text: text };
          },
          function () {
            // Unreadable body — fail closed. Boxed so it can never be
            // confused with a rejection coming from the held request itself.
            return { text: UNREADABLE };
          },
        )
        .then(function (box) {
          var held = decide(box.text);
          // decide() returns null when the request may go out normally; we are
          // already async at this point, so send it from here.
          return held === null ? send(input, init) : held;
        });
    }

    // A body we cannot read as text (Blob, FormData, stream) with no Request to
    // clone from. Only a genuinely absent body passes.
    return decide(init && init.body != null ? UNREADABLE : null);
  }

  window.fetch = function (input, init) {
    var requestUrl = extractUrl(input);
    var requestMethod = extractMethod(input, init).toUpperCase();

    // Evaluated before the output path so a save can never fall through it.
    var route = classifySaveRoute(requestMethod, requestUrl);
    if (route) {
      var held = saveGate(input, init, route);
      if (held) return held;
      return send(input, init);
    }

    var outputEnvId = getEnvFromOutputUrl(requestUrl);
    if (!outputEnvId || requestMethod !== "POST") {
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
