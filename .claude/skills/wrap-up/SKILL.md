---
name: wrap-up
description: End-of-session version alignment for manifests and service workers. Use when the user says "wrap up", "let's wrap up", "finish up", "align versions", or wants to make sure manifest versions and SW cache names are in sync before deploying.
version: 1.0.0
---

# Wrap-Up Skill

Ensures all `manifest.json` versions and service worker `CACHE_NAME` versions are aligned across the bt repo.

## Repo Structure

Sub-apps with a SW:

- **Root** (`/`): `manifest.json` + `sw.js` — cache name pattern `bt-hub-v{version}`
- **nb/**: `manifest.json` + `sw.js` — cache name pattern `nb-cache-v{version}`
- **clauer/**: `manifest.json` + `sw.js` — cache name pattern `clauer-cache-v{version}`
- **tanmateix/**: `manifest.json` + `sw.js` — cache name pattern `tanmateix-cache-v{version}`

Sub-apps without a SW (version tracked in manifest only):

- **stop/**: `manifest.json`
- **summum/**: `manifest.json`

## Alignment Rules

For apps that have both a `manifest.json` and a `sw.js`:

- The version in `manifest.json` and the version embedded in `CACHE_NAME` in `sw.js` **must match exactly**.
- The canonical version is the one in `manifest.json`. If they differ, the SW cache name is stale — bump the manifest patch version and update the SW to match.

## Steps to Execute

1. **Read all manifest.json files** and extract their `version` field.
2. **Read all sw.js files** and extract the version from `CACHE_NAME` (the semver after the last `-v`).
3. **Compare** each manifest version to its corresponding SW version.
4. **For each mismatch**: bump the manifest patch version (e.g. `0.7.2` → `0.7.3`) and update the CACHE_NAME in the SW to match.
5. **Report** a summary table of before/after versions for all apps checked.

## Example Summary Output

```
App        Manifest  SW Cache   Status
─────────────────────────────────────
root       0.1.9     0.1.9      ✓ OK
nb/        0.7.3     0.7.3      ✓ bumped (was 0.7.2 / 0.7.3)
clauer/    0.3.6     0.3.6      ✓ bumped (was 0.3.5 / 0.3.6)
tanmateix/ 0.9.3     0.9.3      ✓ OK
stop/      0.0.4     (no SW)    ✓ OK
summum/    0.0.7     (no SW)    ✓ OK
```

## Notes

- The root `sw.js` caches files from all sub-apps. When any sub-app changes, bump the root manifest + SW together.
- Sub-apps without a SW only need their `manifest.json` version bumped when their files change.
- Do not bump versions for apps that have not changed in the current session.
