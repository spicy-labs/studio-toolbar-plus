## 🚨 READ THIS FIRST — this update resets your extension settings

**This one time only, upgrading to 0.20.0 will erase your saved Toolbar settings.**

To fix the IT/allowlist problem below, the extension now has a permanent identity.
Chrome treats the new identity as a brand-new extension, and Chrome keeps each
extension's saved data separate — so anything the Toolbar had stored locally
starts empty:

*   Magic Layout configurations saved in the extension
*   Layout variable mappings
*   Any other Toolbar preferences and local settings

**Your templates and documents are completely untouched.** Nothing in GraFx Studio
changes. This is *only* the extension's own local storage in your browser. Nothing
is deleted from Studio, from your environment, or from any document you've built.

> 💡 If you have Toolbar configurations you don't want to re-create by hand, export
> or write them down **before** you install 0.20.0.

This is a one-time cost. From 0.20.0 onward the identity is fixed forever, so no
future update will do this again — and as a bonus, upgrading will stop wiping your
settings the way it silently did on every previous release.

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

🐛 Fixed
--------

*   **The "update available" link in the toolbar now opens the right page.** The
    link was missing the `v` in the release tag, so clicking it landed on a
    GitHub 404 instead of the new release.

📦 How to install
-----------------

> **Download `studio-toolbar-plus-v0.20.0.zip` from the Assets list below — do _NOT_ download "Source code (zip)" or "Source code (tar.gz)".** The source archive does not contain the built extension files and Chrome will refuse to load it.

1.  Scroll to **Assets** below and download `studio-toolbar-plus-v0.20.0.zip`.
2.  Unzip it somewhere stable — Chrome reads from this folder at runtime, so don't move or delete it after loading.
3.  In Chrome, open `chrome://extensions` and enable **Developer mode** (top right).
4.  **Remove your existing studio-toolbar-plus entry** before loading the new one. Because the ID changed, Chrome will otherwise happily run both side by side and you'll get two toolbars.
5.  Click **Load unpacked** and select the unzipped folder.
6.  Open the extension's **Details** page and confirm the version reads `0.20.0` and the ID reads `ohbpbenmjbmoghpliikbiepbdpjiopcg`.
