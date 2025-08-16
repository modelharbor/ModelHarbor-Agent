# ModelHarbor Cache Fix

## Problem

The ModelHarbor model list was not refreshing when the "Refresh Models" button was clicked in the settings UI. The newly added "anthropic/claude-opus-4.5" model was not appearing in the model list even though it was successfully fetched from the API, as shown in the developer console logs.

## Root Cause

The issue was caused by multiple layers of caching:

1. **ModelCache Layer** (`src/api/providers/fetchers/modelCache.ts`): Uses both memory and file-based caching with a 5-minute TTL
2. **Types Package Cache** (`packages/types/src/providers/modelharbor.ts`): Has its own internal cache that persists across requests

When the "Refresh Models" button was clicked, only the ModelCache layer was being refreshed, but the Types Package cache was not being cleared, causing stale models to be returned.

## Solution

Implemented a complete cache flush mechanism for ModelHarbor similar to LiteLLM:

### 1. Added Cache Flush on Refresh Request

**File:** `src/core/webview/webviewMessageHandler.ts`

Added code to flush the ModelHarbor cache when the API key is provided via message values (indicating a refresh action):

```typescript
// Flush modelharbor cache if API key is provided via message.values (e.g., Refresh Models button)
if (message?.values?.modelharborApiKey) {
	await flushModels("modelharbor", true)
}
```

### 2. Clear Types Package Internal Cache

**File:** `src/api/providers/fetchers/modelCache.ts`

Modified the `flushModels` function to also clear the ModelHarbor internal cache from the types package:

```typescript
export const flushModels = async (router: RouterName, refresh: boolean = false): Promise<void> => {
	// Clear ModelHarbor's internal cache in the types package
	if (router === "modelharbor") {
		clearModelHarborCache()
	}
	// ... rest of the code
}
```

### 3. Fixed API Key Priority

**File:** `src/core/webview/webviewMessageHandler.ts`

Fixed the API key priority to prefer the value from message (refresh action) over stored configuration:

```typescript
// Before: apiConfiguration.modelharborApiKey || message?.values?.modelharborApiKey
// After: message?.values?.modelharborApiKey || apiConfiguration.modelharborApiKey
```

This ensures that when the user clicks "Refresh Models", the API key from the message is used, triggering a cache flush.

## Testing

Added comprehensive tests in `src/core/webview/__tests__/webviewMessageHandler.routerModels.spec.ts`:

1. **Test: flushes modelharbor cache when modelharborApiKey is provided via message values**

    - Verifies that `flushModels("modelharbor", true)` is called when API key is in message values
    - Confirms the new API key from message values is used for fetching

2. **Test: does not flush modelharbor cache when modelharborApiKey is not provided via message values**
    - Ensures cache is not unnecessarily flushed on normal requests
    - Confirms stored credentials are used when no message values are provided

All existing tests continue to pass, ensuring backward compatibility.

## Impact

- Users can now successfully refresh the ModelHarbor model list to see newly added models
- The cache is only flushed when explicitly requested (via the Refresh Models button)
- Normal operations continue to benefit from caching for better performance
- The fix follows the same pattern used for LiteLLM, ensuring consistency

## Files Modified

1. `src/core/webview/webviewMessageHandler.ts` - Added cache flush trigger and fixed API key priority
2. `src/api/providers/fetchers/modelCache.ts` - Added Types Package cache clearing
3. `src/core/webview/__tests__/webviewMessageHandler.routerModels.spec.ts` - Added test coverage
