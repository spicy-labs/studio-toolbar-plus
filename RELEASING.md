# Releasing

This project publishes releases via GitHub Actions. Pushing a tag matching `v*` (e.g. `v0.17.1`) triggers `.github/workflows/release.yml`, which builds the extension and publishes a GitHub Release with a downloadable zip attached.

## One-time setup

The `dist/` directory should no longer be tracked in git — it's a build artifact, produced fresh by CI on every release.

```bash
echo "dist/" >> .gitignore
git rm -r --cached dist/
git commit -m "chore: stop tracking built dist/ files"
git push
```

After this, developers loading the extension from source need to run `bun install && bun run build` once before loading the `dist/` files via "Load unpacked" in Chrome.

## Cutting a release

Releases can be cut from any branch — the workflow triggers on the tag, not the branch it points to. The typical flow for this project is to cut a **pre-release off a feature branch** so it can be tested early, then flip it to a full release after the branch merges into `main`. See [Pre-releases](#pre-releases) below for that flow.

The steps below assume you're on the branch you want to release from (could be `main`, could be a feature branch).

1. **Bump the version in `manifest.json`.** This is the only place the version lives. Use [semver](https://semver.org): patch for bug fixes, minor for new features, major for breaking changes.

   ```json
   "version": "0.17.1"
   ```

2. **Commit the bump and push the branch.**

   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   git add manifest.json
   git commit -m "chore: bump version to 0.17.1"
   git push origin "$BRANCH"
   ```

3. **Tag and push.** The tag must be `v` + the manifest version — the workflow fails the build if they disagree. The tag points at the current commit on your branch, so make sure the bump commit is the one you want released.

   ```bash
   git tag v0.17.1
   git push origin v0.17.1
   ```

4. **Watch the workflow run** at `https://github.com/<owner>/studio-toolbar-plus/actions`. It takes ~1–2 minutes. On success, the release appears at `https://github.com/<owner>/studio-toolbar-plus/releases` with `studio-toolbar-plus-v0.17.1.zip` attached.

## Pre-releases

The workflow auto-detects pre-releases: if the tagged commit isn't reachable from `origin/main`, the release is created with `--prerelease`. That keeps the orange "Pre-release" badge on branch builds and keeps them out of the "Latest" slot, so anyone landing on the repo home sees the last real release instead of a work-in-progress.

No action needed at tag time — just push the tag from your branch.

### Promoting a pre-release to a full release

Once the feature branch is merged into `main` and you're confident in the build:

```bash
gh release edit v0.17.1 --prerelease=false --latest
```

The tag itself doesn't move — it still points at the commit on the original branch (which is now part of `main`'s history via the merge). Only the release's pre-release flag and "latest" status change.

If you need the tag to point at the merge commit on `main` instead of the original branch tip (e.g. the merge introduced fixups), that's a re-tag — see [Recovering from a bad tag](#recovering-from-a-bad-tag).

## What's in the zip

The release zip contains everything Chrome needs to install the extension — and nothing else:

- `manifest.json`
- `content.js`
- `downloader.js`
- `icons/`
- `dist/index.js`
- `dist/index.css`

Source maps, dev scripts, and source files are excluded. If you add a new top-level file that the extension needs at runtime, also add it to the `Package extension` step in `release.yml`.

## Verifying a release

1. Download the zip from the Releases page.
2. Unzip it.
3. In Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select the unzipped folder.
4. Open the extension's "Details" page and confirm the version matches the tag.

## Recovering from a bad tag

If you tagged the wrong commit or the workflow produced a broken release, delete both the tag and the release before re-tagging:

```bash
# Delete the local and remote tag
git tag -d v0.17.1
git push --delete origin v0.17.1

# Delete the GitHub release (the draft or published one)
gh release delete v0.17.1 --yes
```

Then fix the underlying issue, re-tag, and push again. Avoid re-using a version number that's already been distributed to users — bump to the next patch instead.

## How the workflow stays trustworthy

The release workflow uses only one third-party GitHub Action, `actions/checkout`, which is maintained by GitHub itself. Bun is installed via its official install script, and the release is created using the `gh` CLI that ships pre-installed on GitHub-hosted runners. No community actions are in the publish path.
