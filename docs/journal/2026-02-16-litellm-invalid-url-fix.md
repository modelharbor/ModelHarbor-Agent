# Fix LiteLLM "Invalid URL" Error When Refreshing Models

**Date:** 2026-02-16
**Author:** ModelHarbor Agent

## Summary

Fixed a bug where clicking "Refresh Models" for the LiteLLM provider in developer tools would throw an "Invalid URL" error, preventing model list refresh.

## Problem

When a user clicked the "Refresh Models" button for the LiteLLM provider, the extension threw an `Invalid URL` error instead of refreshing the model list.

## Root Cause Analysis

The issue stemmed from a missing credential forwarding chain:

1. The "Refresh Models" button triggers `flushModels("litellm", true)` in `webviewMessageHandler.ts`
2. `flushModels()` was called **without** passing `apiKey` and `baseUrl` from the message payload
3. This caused `getLiteLLMModels(undefined, undefined)` to be invoked
4. Inside the fetcher, `new URL(undefined)` threw `TypeError: Invalid URL`

```
User clicks "Refresh Models"
  → webviewMessageHandler: flushModels("litellm", true)  // no credentials passed
    → modelCache.refreshModels()
      → getLiteLLMModels(undefined, undefined)
        → new URL(undefined)  // TypeError: Invalid URL
```

## Solution

### 1. Guard Check in LiteLLM Fetcher (`src/api/providers/fetchers/litellm.ts`)

Added an early return guard that checks if `baseUrl` is `undefined` or empty before attempting to construct a `URL` object. When `baseUrl` is missing, the function returns an empty object `{}` instead of throwing an error.

### 2. Options Parameter for `flushModels()` (`src/api/providers/fetchers/modelCache.ts`)

Extended `flushModels()` to accept an optional `options` parameter containing credentials (`apiKey`, `baseUrl`). These options are forwarded to `refreshModels()` so the fetcher receives the necessary connection details.

### 3. Credential Forwarding in Message Handler (`src/core/webview/webviewMessageHandler.ts`)

Updated the `flushModels()` call site to extract `apiKey` and `baseUrl` from `message.values` and pass them through for LiteLLM and ModelHarbor providers.

## Files Changed

| File                                        | Change                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/api/providers/fetchers/litellm.ts`     | Added guard check for undefined/empty `baseUrl` — returns `{}` instead of throwing                       |
| `src/api/providers/fetchers/modelCache.ts`  | Added `options` parameter to `flushModels()` for credential forwarding to `refreshModels()`              |
| `src/core/webview/webviewMessageHandler.ts` | Passes `apiKey`/`baseUrl` from `message.values` when calling `flushModels()` for LiteLLM and ModelHarbor |

## Tests Added

| File                                                      | Tests | Description                                                                                                    |
| --------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `src/api/providers/fetchers/__tests__/litellm.spec.ts`    | 5     | Validates `baseUrl` guard check — returns empty object for undefined, empty string, and whitespace-only inputs |
| `src/api/providers/fetchers/__tests__/modelCache.spec.ts` | 4     | Validates `flushModels()` correctly forwards options to `refreshModels()`                                      |
