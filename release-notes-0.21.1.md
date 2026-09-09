🐛 Fixed
--------

*   **Switching layouts no longer gets mistaken for moving frames.** This is the
    fix for the broken artwork on Magic Layout variants.

    Magic Layouts lets you nudge a frame and have that nudge remembered, so it
    comes back the next time you land on that variant. It does this by comparing
    where the frames are now against where it last put them, and treating any
    difference as "the designer moved this."

    The problem was *when* it made that comparison. It also ran when you switched
    layouts — and at that exact moment the engine has already reported the new
    layout's name while still reporting the *old* layout's frame positions. So
    switching from Layout A to Layout B looked, to the feature, like every frame
    on Layout B had just been dragged into Layout A's arrangement. It dutifully
    saved that as a remembered adjustment and replayed it the next time the
    Layout B variant came up.

    Nobody had moved anything — a layout switch was being misread as a manual
    edit.

📦 How to install
-----------------

> **Download `studio-toolbar-plus-v0.21.1.zip` from the Assets list below — do _NOT_ download "Source code (zip)" or "Source code (tar.gz)".** The source archive does not contain the built extension files and Chrome will refuse to load it.

1.  Scroll to **Assets** below and download `studio-toolbar-plus-v0.21.1.zip`.
2.  Unzip it somewhere stable — Chrome reads from this folder at runtime, so don't move or delete it after loading.
3.  In Chrome, open `chrome://extensions` and enable **Developer mode** (top right).
4.  Click **Load unpacked** and select the unzipped folder.

Since 0.20.0 the extension ID is fixed at `ohbpbenmjbmoghpliikbiepbdpjiopcg`, so
updating over an existing install keeps your settings and any IT allowlist entry.
