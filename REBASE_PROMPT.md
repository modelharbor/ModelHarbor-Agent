# Rebase ModelHarbor Agent onto Upstream (Roo-Code)

## Context

I need to rebase my ModelHarbor Agent fork onto the latest upstream Roo-Code version. My fork has 2 commits on top of an older upstream version that implement ModelHarbor-specific customizations.

## My Fork Details

- **Fork Repository**: `https://github.com/modelharbor/ModelHarbor-Agent.git` (origin)
- **Upstream Repository**: `https://github.com/RooCodeInc/Roo-Code.git` (upstream)
- **Current Branch**: `version3.37.1`
- **Commits to preserve**: Last 2 commits

### Commit 1: `52a2d4df` - "Add ModelHarbor"

This is the main ModelHarbor integration commit that:

**Files Added (New ModelHarbor-specific files):**

- `packages/types/src/providers/modelharbor.ts` - ModelHarbor provider type definitions (432 lines)
- `src/api/providers/modelharbor.ts` - ModelHarbor API provider implementation (380 lines)
- `src/api/providers/fetchers/modelharbor.ts` - ModelHarbor model fetcher (191 lines)
- `src/services/code-index/embedders/modelharbor.ts` - ModelHarbor embeddings support (240 lines)
- `src/api/transform/caching/modelharbor.ts` - ModelHarbor caching transform
- `src/api/providers/__tests__/modelharbor*.ts` - Multiple test files for ModelHarbor
- `webview-ui/src/components/settings/providers/ModelHarbor.tsx` - ModelHarbor settings UI
- Thai language localization files (`locales/th/`, `src/i18n/locales/th/`, `webview-ui/src/i18n/locales/th/`)
- Documentation: `docs/new-dynamic-provider.md`, `docs/new-fixed-provider.md`, `MODELHARBOR_CACHE_FIX.md`, `CHANGELOG_HAIKU_45_NATIVE_TOOLS.md`
- Scripts: `scripts/install-latest.sh`, `scripts/push-vsix.sh`, etc.

**Files Modified (Integration points):**

- `packages/types/src/provider-settings.ts` - Added ModelHarbor to provider settings
- `packages/types/src/providers/index.ts` - Export ModelHarbor provider types
- `packages/types/src/codebase-index.ts` - Added ModelHarbor embeddings support
- `src/api/index.ts` - Register ModelHarbor provider
- `src/api/providers/index.ts` - Export ModelHarbor provider
- `src/api/providers/constants.ts` - Add ModelHarbor constants
- `src/services/code-index/config-manager.ts` - ModelHarbor embeddings config
- `src/services/code-index/service-factory.ts` - ModelHarbor embeddings factory
- `src/core/config/ProviderSettingsManager.ts` - ModelHarbor settings management
- `src/core/webview/webviewMessageHandler.ts` - Handle ModelHarbor messages
- `src/extension.ts` - ModelHarbor extension activation
- `webview-ui/src/components/settings/ApiOptions.tsx` - ModelHarbor API options
- `webview-ui/src/components/settings/providers/index.ts` - Register ModelHarbor settings component

**Files Removed (Cleanup):**

- Removed Chutes provider (replaced with ModelHarbor): `src/api/providers/chutes.ts`, `packages/types/src/providers/chutes.ts`
- Removed non-Thai localization directories
- Removed certain cloud-related files (if any cleanup was done)

### Commit 2: `7f9f03c2` - "Add modelharbor"

This is a refinement/fix commit that:

**Files Removed:**

- `packages/cloud/*` - Entire cloud package removed
- `packages/telemetry/*` - Entire telemetry package removed
- `packages/types/src/cloud.ts` - Cloud type definitions
- `packages/types/src/telemetry.ts` - Telemetry type definitions
- `packages/types/src/providers/roo.ts` - Roo provider (not needed in fork)
- `src/api/providers/roo.ts` - Roo provider implementation
- `src/api/providers/fetchers/roo.ts` - Roo model fetcher
- Various telemetry-related files and tests

**Files Modified:**

- Updates to remove telemetry/cloud dependencies from core files
- Simplified `ClineProvider.ts` (removed cloud integration)
- Updated various tests to remove cloud/telemetry mocking

---

## Rebase Instructions

When upstream has a new version and I need to rebase my features, help me:

1. **Fetch latest upstream**:

    ```bash
    git fetch upstream
    git log upstream/main --oneline -5  # Check latest commits
    ```

2. **Create a new branch from upstream**:

    ```bash
    git checkout -b version<NEW_VERSION> upstream/main
    ```

3. **Cherry-pick or rebase my 2 commits**:

    ```bash
    # Option A: Cherry-pick (recommended for cleaner history)
    git cherry-pick 52a2d4df13b38e452e2ddc297dfefe5b498107a3
    git cherry-pick 7f9f03c2695f5252130039462dc0694804af2a67

    # Option B: Rebase
    git rebase --onto upstream/main HEAD~2 version3.37.1
    ```

4. **Handle conflicts** - Expected conflict areas:

    - `packages/types/src/provider-settings.ts` - Provider type additions
    - `packages/types/src/providers/index.ts` - Provider exports
    - `src/api/index.ts` - API provider registration
    - `src/api/providers/index.ts` - Provider exports
    - `src/core/webview/webviewMessageHandler.ts` - Message handling
    - `src/extension.ts` - Extension activation
    - `webview-ui/src/components/settings/ApiOptions.tsx` - Settings UI
    - Various locale/i18n files

5. **Test after rebase**:
    ```bash
    pnpm install
    cd src && npx vitest run tests/
    cd ../webview-ui && npx vitest run
    ```

---

## Key Files to Watch for Conflicts

### Critical Integration Files (likely to conflict):

1. **`packages/types/src/provider-settings.ts`** - Always add ModelHarbor type
2. **`src/api/index.ts`** - Register ModelHarbor in provider factory
3. **`src/api/providers/constants.ts`** - Add MODELHARBOR constant
4. **`packages/types/src/providers/index.ts`** - Export modelharbor types
5. **`src/services/code-index/interfaces/embedder.ts`** - Add "modelharbor" to embedder types
6. **`src/services/code-index/service-factory.ts`** - Add ModelHarbor embedder case

### Files That Need Cloud/Telemetry Removal:

- `src/core/webview/ClineProvider.ts`
- `src/extension.ts`
- `packages/types/src/index.ts`
- Any new files that import from `@roo-code/cloud` or `@roo-code/telemetry`

### New Upstream Files to Check:

- Any new providers added (may need similar treatment as Chutes removal)
- Any new locale files (keep only `en` and `th`)
- Any new cloud/telemetry features (need to stub or remove)

---

## My Fork Philosophy

1. **Replace Roo branding with ModelHarbor** - Update names, icons, and references
2. **Thai-first localization** - Keep only English and Thai locales
3. **Remove cloud features** - Self-hosted approach, no cloud dependencies
4. **Remove telemetry** - Privacy-focused, no tracking
5. **Add ModelHarbor provider** - Custom API endpoint for ModelHarbor service
6. **Keep core functionality** - All agent capabilities, MCP, tools, etc.

---

## Prompt for Rebase Session

When starting a new rebase session, use this prompt:

```
I need to rebase my ModelHarbor Agent fork onto the latest upstream Roo-Code version.

Current state:
- My fork branch: version<CURRENT> at commit <HASH>
- Upstream: <NEW_VERSION> at commit <UPSTREAM_HASH>
- My 2 commits to preserve: 52a2d4df ("Add ModelHarbor") and 7f9f03c2 ("Add modelharbor")

Please help me:
1. Create a new branch from upstream/main called version<NEW_VERSION>
2. Cherry-pick my 2 commits onto it
3. Resolve any conflicts by:
   - Keeping ModelHarbor provider additions
   - Removing any new cloud/telemetry imports from upstream
   - Keeping only en and th locales
   - Updating provider exports and registrations to include ModelHarbor
4. Run tests to verify everything works
5. Provide a summary of changes made

Key files I need to preserve from my fork:
- packages/types/src/providers/modelharbor.ts (NEW)
- src/api/providers/modelharbor.ts (NEW)
- src/api/providers/fetchers/modelharbor.ts (NEW)
- src/services/code-index/embedders/modelharbor.ts (NEW)
- webview-ui/src/components/settings/providers/ModelHarbor.tsx (NEW)
- All th/ locale directories (NEW)
- Thai localization files

Files to remove from upstream if they exist:
- packages/cloud/* (REMOVE)
- packages/telemetry/* (REMOVE)
- src/api/providers/roo.ts (REMOVE - replaced with modelharbor)
- Non-en/th locale directories (REMOVE)
```
