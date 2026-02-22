# Fix Turbo Cache Not Invalidating on Version Change

**Date:** 2026-02-16
**Author:** ModelHarbor Agent

## Summary

Fixed an issue where the webview-ui build cache was not invalidated when the extension version in `src/package.json` changed, causing stale version numbers to appear in the Announcement component after `pnpm vsix`.

## Problem

After bumping the version in `src/package.json` and running `pnpm vsix`, the Announcement component in the webview still displayed the old version number. The build appeared to succeed, but Turbo served a cached result for the webview-ui build step.

## Root Cause Analysis

The root `turbo.json` defines the `build` task inputs as:

```json
"build": {
    "outputs": ["dist/**"],
    "inputs": ["src/**", "package.json", "tsconfig.json", "tsup.config.ts", "vite.config.ts"]
}
```

These input paths are **relative to each workspace package**. For the `webview-ui` workspace, Turbo only watches:

- `webview-ui/src/**`
- `webview-ui/package.json`
- `webview-ui/tsconfig.json`
- `webview-ui/vite.config.ts`

The extension's `src/package.json` (which contains the version number used by the Announcement component) is **outside** the webview-ui workspace boundary. Turbo had no reason to invalidate the webview-ui build cache when only `src/package.json` changed.

```
Version bump in src/package.json
  → Turbo checks webview-ui inputs
    → src/package.json is not in webview-ui's input list
      → Cache hit — stale build served
        → Announcement shows old version
```

## Solution

Created a workspace-level `webview-ui/turbo.json` that extends the root configuration and adds `../src/package.json` as an additional input for the `build` task:

```json
{
	"$schema": "https://turbo.build/schema.json",
	"extends": ["//"],
	"tasks": {
		"build": {
			"inputs": ["$TURBO_DEFAULT$", "../src/package.json"]
		}
	}
}
```

- `"extends": ["//"]` inherits all configuration from the root `turbo.json`
- `$TURBO_DEFAULT$` preserves the default inputs defined in the root config
- `../src/package.json` adds the extension's package.json as an additional cache key

Now when the version in `src/package.json` changes, Turbo correctly invalidates the webview-ui build cache and produces a fresh build with the updated version.

## Files Changed

| File                    | Change                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| `webview-ui/turbo.json` | Created workspace-level Turbo config adding `../src/package.json` to build inputs |
