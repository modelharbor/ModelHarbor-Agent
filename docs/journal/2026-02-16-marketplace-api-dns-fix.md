# Fix MCP Marketplace API DNS Resolution Failure

**Date:** 2026-02-16
**Author:** ModelHarbor Agent

## Summary

Fixed a DNS resolution failure in the MCP Marketplace that prevented loading remote mode and MCP server configurations. The API base URL pointed to a non-existent host, and the Accept header did not match the actual response content type.

## Problem

The MCP Marketplace failed to load any remote configurations with the error "No such host is known", making the marketplace feature completely non-functional.

## Root Cause Analysis

Two issues were identified in `RemoteConfigLoader.ts`:

1. **DNS Resolution Failure**: The base URL was set to `https://api.modelharbor.io` which does not resolve in DNS. The actual working API endpoints are:

    - `https://app.roocode.com/api/marketplace/modes`
    - `https://app.roocode.com/api/marketplace/mcps`

2. **Content-Type Mismatch**: The request headers included `Accept: "application/json"` and `Content-Type: "application/json"`, but the server responds with `application/x-yaml` content. This could cause issues with content negotiation.

```
RemoteConfigLoader.fetchItems()
  → fetch("https://api.modelharbor.io/v1/marketplace/modes")  // DNS fails
    → Error: "No such host is known"
```

## Solution

### 1. Base URL Correction (`src/services/marketplace/RemoteConfigLoader.ts`, line 27)

Changed the base URL from `https://api.modelharbor.io` to `https://app.roocode.com` so that API requests resolve to the correct host.

### 2. Accept Header Fix (`src/services/marketplace/RemoteConfigLoader.ts`, lines 91-96)

Updated the `Accept` header to `application/x-yaml, application/json` to match the actual server response format, and removed the unnecessary `Content-Type` header since these are GET requests with no request body.

## Files Changed

| File                                                           | Change                                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/services/marketplace/RemoteConfigLoader.ts` (line 27)     | Changed base URL from `https://api.modelharbor.io` to `https://app.roocode.com`              |
| `src/services/marketplace/RemoteConfigLoader.ts` (lines 91-96) | Changed Accept header to `application/x-yaml, application/json`; removed Content-Type header |

## Tests Updated/Added

| File                                                            | Details                                                                                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/marketplace/__tests__/RemoteConfigLoader.spec.ts` | Updated URL assertions to use new base URL; updated header assertions to match new Accept header; added 3 new tests for API configuration validation |
