# Fix: Haiku 4.5 Native Tool Protocol Support in ModelHarbor

## Summary

Fixed the ModelHarbor provider to properly support native tool protocol for Haiku 4.5 models, matching the behavior of the Amazon Bedrock provider.

## Problem

The ModelHarbor provider was only using native tools when `toolProtocol` was explicitly set to `"native"`. This meant that Haiku 4.5 models, which have `defaultToolProtocol: "native"`, were not automatically using native tools unless explicitly configured.

## Solution

Changed the tool protocol detection logic in `src/api/providers/modelharbor.ts` to match Bedrock's approach:

### Before

```typescript
const useNativeTools =
	supportsNativeTools &&
	metadata?.tools &&
	metadata.tools.length > 0 &&
	metadata?.toolProtocol === TOOL_PROTOCOL.NATIVE
```

### After

```typescript
const useNativeTools =
	supportsNativeTools &&
	metadata?.tools &&
	metadata.tools.length > 0 &&
	metadata?.toolProtocol !== "xml" &&
	metadata?.tool_choice !== "none"
```

## Behavior Changes

### For Haiku 4.5 Models (defaultToolProtocol: "native")

- **Before**: Required explicit `toolProtocol: "native"` to use native tools
- **After**: Automatically uses native tools unless `toolProtocol: "xml"` is explicitly set

### For Other Models (defaultToolProtocol: "xml")

- **Before**: Only used native tools when `toolProtocol: "native"` was explicitly set
- **After**: Same behavior - still only uses native tools when `toolProtocol: "native"` is explicitly set

### When tool_choice is "none"

- **Before**: Would still attempt to use native tools if protocol was set
- **After**: Correctly respects `tool_choice: "none"` and doesn't use native tools

## Test Coverage

Added comprehensive test suite in `src/api/providers/__tests__/modelharbor-native-tools.spec.ts`:

1. ✅ Haiku 4.5 uses native tools by default (without explicit toolProtocol)
2. ✅ Haiku 4.5 respects explicit `toolProtocol: "xml"` override
3. ✅ Sonnet 4 uses native tools when explicitly set to `toolProtocol: "native"`
4. ✅ Models respect `tool_choice: "none"` and don't use native tools

All 25 ModelHarbor-related tests pass.

## Files Modified

- `src/api/providers/modelharbor.ts` - Updated tool protocol detection logic
- `src/api/providers/__tests__/modelharbor-native-tools.spec.ts` - Added new test suite

## Alignment with Other Providers

This change aligns ModelHarbor's behavior with:

- **Amazon Bedrock** (lines 348-355 in `src/api/providers/bedrock.ts`)
- **Anthropic** (lines 70-74 in `src/api/providers/anthropic.ts`)

Both use the pattern: `metadata?.toolProtocol !== "xml"` to enable native tools by default when supported.
