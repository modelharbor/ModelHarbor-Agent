# Fix VSIX Build Error: Missing @roo-code/build dist

**Date:** 2026-02-16
**Author:** ModelHarbor Agent

## Summary

Fixed a VSIX build error caused by the `@roo-code/build` workspace package not having its `dist/` directory built before `pnpm vsix` was run.

## Problem

Running `pnpm vsix` in `src/` resulted in the following error:

```
Error: Cannot find package 'D:\work-coding\ModelHarbor\ModelHarbor-Agent\src\node_modules\@roo-code\build\dist\index.js' imported from D:\work-coding\ModelHarbor\ModelHarbor-Agent\src\esbuild.mjs
```

## Root Cause Analysis

The issue stemmed from a missing build artifact in the `@roo-code/build` workspace package:

1. `src/esbuild.mjs` imports `@roo-code/build` which is a workspace package located at `packages/build/`
2. `packages/build/package.json` defines `"main": "./dist/index.js"` and `"build": "tsc"`
3. The `packages/build/dist/` directory did not exist because `tsc` had not been run yet
4. Running `pnpm vsix` directly does not go through the turbo pipeline, so dependencies are not automatically built beforehand

```
pnpm vsix (in src/)
  → esbuild.mjs imports @roo-code/build
    → resolves to packages/build/dist/index.js
      → dist/ does not exist — Error: Cannot find package
```

## Solution

Built the `@roo-code/build` package manually before running the VSIX build:

```bash
cd packages/build && pnpm build    # runs tsc, creates dist/
cd src && pnpm vsix                # now succeeds
```

## Result

VSIX package built successfully:

```
bin/modelharbor-agent-3.41.2.vsix (998 files, 21.49 MB)
```

## Note

To avoid this issue in the future, use the turbo pipeline from the root directory which automatically builds all dependencies in the correct order:

```bash
pnpm turbo run bundle --filter=modelharbor-agent
```
