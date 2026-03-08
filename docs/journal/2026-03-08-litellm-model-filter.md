# LiteLLM model filter

## Date: 2026-03-08

## Summary of changes

- Added filter logic in the LiteLLM provider to remove non-chat/completion models from the model list shown in settings
- Filtered keywords: `image`, `embedding`, `rerank`
- The filter is case-insensitive and checks both `modelName` and `litellmModelName`

## Files changed

1. [`src/api/providers/fetchers/litellm.ts`](../../src/api/providers/fetchers/litellm.ts) - added the `isNonChatModel()` helper and filtering logic inside `getLiteLLMModels()`
2. [`src/__tests__/litellm-model-filter.spec.ts`](../../src/__tests__/litellm-model-filter.spec.ts) - added 9 new test cases covering the helper function and integration behavior

## Problem addressed

- The LiteLLM settings model list included image generation, embedding, and rerank models mixed into the available models
- This could lead users to select a model type that is not appropriate for chat usage

## Solution

- Added filtering at fetch time inside `getLiteLLMModels()` so the behavior applies to every code path that consumes this data, including the extension state path and the react-query path
