✨ Improved
-----------

*   **The Toolbar now stops you saving a template that your environment would no
    longer be able to open.** This is the big one, and it closes a hole that could
    quietly destroy work.

    Studio Version override (added in 0.19.0) lets you load a template on a
    different Studio version than your environment's default. What wasn't obvious
    is what happens if you then hit **Save** while pinned to a *newer* version:

    *   Every Studio version writes templates in a document format, and that
        format has its own version number.
    *   A newer Studio can open an older template — it upgrades it on the way in.
        **The reverse is not possible.** There is no downgrade, anywhere, by
        design.
    *   So saving from a newer override rewrites your stored template in a format
        your environment's default version can *never* read again. The save
        succeeds. Nothing warns you. The template is simply broken for everyone
        else — and for server-side output — from that moment on, permanently.

    Worse, you didn't even have to change anything: **just opening a template on a
    newer override and pressing Save was enough**, because Studio stamps the new
    format version on the way out.

    From this release the Toolbar catches that save before it leaves your browser:

    *   **The save is held, not sent.** Nothing reaches the server until you
        decide.
    *   **A modal explains exactly what would happen** — which version your tab is
        running, which one your environment is on, and that there is no way back.
    *   **You can still force it through** if you genuinely mean to. That's a
        deliberate choice, not a dead end.
    *   **Cancel, Escape, or clicking outside all safely release the save** — your
        editor never gets stuck waiting.
    *   This covers **Save, Save As, and components**, not just the obvious case.
    *   **Renaming is never blocked.** Only requests carrying a document are
        held — and if one can't be read at all, it's held rather than waved
        through, because guessing wrong in that direction is unrecoverable.

    Saving while pinned to an *older* version is left alone, because it is safe:
    the template is written in an older format that your environment upgrades
    normally on the next open.

*   **The version picker now tells you where you stand before you commit.**

    *   **Your environment's default version is shown** alongside the version this
        tab is running, so a pinned tab can't quietly look like a normal one.
    *   **Picking a newer version warns you** that saving may leave the template
        unopenable, and that the Toolbar will ask before any save goes through.
    *   **Picking an older version gets a quieter note** that recently-saved
        templates may simply refuse to open on it. That one is deliberately
        low-key: it fails safely and loses nothing, and dressing both warnings up
        the same way would just train you to ignore the one that matters.

🐛 Fixed
--------

*   **The "override expired" banner no longer implies you're back to normal.** It
    used to read "reload to return to the default version" — but the tab is still
    running the override until you actually reload it, and saves from it are still
    dangerous. It now says so plainly.

*   **The apply-version confirmation no longer shows the wrong warning.** It
    warned that "a document authored on a newer engine can fail to render on an
    older one" whichever direction you picked — advice that only makes sense when
    you're going *older*. Each direction now gets the warning that actually
    applies to it.

📦 How to install
-----------------

> **Download `studio-toolbar-plus-v0.21.0.zip` from the Assets list below — do _NOT_ download "Source code (zip)" or "Source code (tar.gz)".** The source archive does not contain the built extension files and Chrome will refuse to load it.

1.  Scroll to **Assets** below and download `studio-toolbar-plus-v0.21.0.zip`.
2.  Unzip it somewhere stable — Chrome reads from this folder at runtime, so don't move or delete it after loading.
3.  In Chrome, open `chrome://extensions` and enable **Developer mode** (top right).
4.  Click **Load unpacked** and select the unzipped folder.

Since 0.20.0 the extension ID is fixed at `ohbpbenmjbmoghpliikbiepbdpjiopcg`, so
updating over an existing install keeps your settings and any IT allowlist entry.
