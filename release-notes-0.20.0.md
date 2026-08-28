✨ Improved
-----------

*   **The extension now has a permanent, unchanging extension ID.** Every version
    of the Toolbar up to 0.19.0 got a *different* ID depending on which folder you
    unzipped it into. That made life miserable for anyone at a company that
    controls which Chrome extensions are allowed:
    *   **IT allowlists actually stick now.** Previously your IT admin would
        allowlist the Toolbar, you'd install the next version, Chrome would treat
        it as a completely different extension, and it would be blocked all over
        again. Now they allowlist it once and it keeps working through every
        future update.
    *   **The ID to give your IT department is:**

        ```
        ohbpbenmjbmoghpliikbiepbdpjiopcg
        ```

        (Chrome policy: `ExtensionInstallAllowlist`.)
    *   **Your settings will survive upgrades from now on.** Because the ID used
        to change on every install, Chrome quietly handed you a fresh, empty
        storage bucket each time you updated. That's why your configurations kept
        vanishing. It won't happen again after this release.

*   **Studio Version override is much harder to be fooled by.** The override
    (added in 0.19.0) lets you load a template on a specific Studio engine
    instead of your environment's default. It now tells you, at all times, that
    it is on:
    *   **A persistent banner sits in the toolbar while an override is active,**
        showing which version you're pinned to and how much time is left before
        it lapses. It updates as the clock runs down and flags the moment the
        override expires, so a pinned tab can no longer masquerade as a normal one.
    *   **Applying or clearing an override now asks first, then reloads.** Both
        actions require a page reload to take effect, so the modal confirms
        up front and warns that unsaved changes will be lost — rather than
        reloading out from under you or leaving you on a stale page that
        silently disagrees with the setting you just changed.
    *   **The modal now names the version you're actually running.** "This
        template is loaded in X" reads the version the tab genuinely booted on,
        and the clear-override prompt names the real environment default instead
        of a generic "the default version."

🐛 Fixed
--------

*   **The "update available" link in the toolbar now opens the right page.** The
    link was missing the `v` in the release tag, so clicking it landed on a
    GitHub 404 instead of the new release.

*   **Run-mode exports now use the overridden engine, not the environment
    default.** With a Studio Version override active, the tab previewed on the
    version you picked but server-side output (PDF, PNG, JPG, MP4, GIF, HTML)
    was still rendered on your environment's default engine — a wrong result
    that looked entirely correct. Output requests now carry the overridden
    engine, so what you export matches what you tested. Only tabs that actually
    booted with the override are affected; a clean tab still exports on the
    default. If a request ever slips past the rewrite, you get an error alert
    rather than a quietly mismatched file.

📦 How to install
-----------------

> **Download `studio-toolbar-plus-v0.20.0.zip` from the Assets list below — do _NOT_ download "Source code (zip)" or "Source code (tar.gz)".** The source archive does not contain the built extension files and Chrome will refuse to load it.

1.  Scroll to **Assets** below and download `studio-toolbar-plus-v0.20.0.zip`.
2.  Unzip it somewhere stable — Chrome reads from this folder at runtime, so don't move or delete it after loading.
3.  In Chrome, open `chrome://extensions` and enable **Developer mode** (top right).
4.  **Remove your existing studio-toolbar-plus entry** before loading the new one. Because the ID changed, Chrome will otherwise happily run both side by side and you'll get two toolbars.
5.  Click **Load unpacked** and select the unzipped folder.
6.  Open the extension's **Details** page and confirm the version reads `0.20.0` and the ID reads `ohbpbenmjbmoghpliikbiepbdpjiopcg`.

