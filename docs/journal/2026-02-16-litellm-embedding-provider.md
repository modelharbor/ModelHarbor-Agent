# Add LiteLLM Embedding Provider for Code Index

**Date:** 2026-02-16
**Author:** ModelHarbor Agent

## Summary

Added LiteLLM as a new embedding provider for the Code Index feature. LiteLLM uses an OpenAI-compatible API for embeddings and supports fetching a dynamic model list from the LiteLLM `/v1/model/info` API endpoint.

## Motivation

LiteLLM already has a chat/completion provider in the project, but lacked an embedding provider. Users who deploy a LiteLLM proxy server want to use embedding models they've already deployed (e.g. `baai/bge-m3`, `qwen/qwen3-embedding-4b`) for code indexing without needing a separate embedding service.

## Architecture

- **LiteLLM Embedder** wraps `OpenAICompatibleEmbedder`, following the same pattern used by OpenRouter and Vercel AI Gateway
- **Model fetching** calls the `/v1/model/info` endpoint and filters to only models where `model_info.dimension > 0` (i.e. actual embedding models)
- **UI auto-population**: When the chat provider is already set to LiteLLM, the base URL and API key are auto-populated in the embedding configuration UI

## Files Created

| File                                                              | Description                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/services/code-index/embedders/litellm.ts`                    | `LiteLLMEmbedder` class wrapping `OpenAICompatibleEmbedder`             |
| `src/services/code-index/litellm-model-fetcher.ts`                | Fetch and filter embedding models from the LiteLLM `/v1/model/info` API |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`     | 13 tests for `LiteLLMEmbedder`                                          |
| `src/services/code-index/__tests__/litellm-model-fetcher.spec.ts` | 23 tests for model fetcher                                              |

## Files Modified

| File                                                        | Change                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `packages/types/src/embedding.ts`                           | Added `"litellm"` to `EmbedderProvider` type              |
| `packages/types/src/codebase-index.ts`                      | Added litellm to Zod schemas                              |
| `packages/types/src/global-settings.ts`                     | Added secret key for LiteLLM embedding API key            |
| `packages/types/src/vscode-extension-host.ts`               | Added message types and `LiteLLMEmbeddingModel` interface |
| `src/shared/embeddingModels.ts`                             | Added litellm embedding profiles                          |
| `src/services/code-index/interfaces/embedder.ts`            | Added litellm to `AvailableEmbedders`                     |
| `src/services/code-index/interfaces/manager.ts`             | Added litellm to `EmbedderProvider`                       |
| `src/services/code-index/interfaces/config.ts`              | Added `litellmOptions` configuration                      |
| `src/services/code-index/service-factory.ts`                | Added litellm branch for embedder instantiation           |
| `src/services/code-index/config-manager.ts`                 | Added litellm config handling                             |
| `src/core/webview/webviewMessageHandler.ts`                 | Added `fetchLiteLLMEmbeddingModels` message handler       |
| `webview-ui/src/components/chat/CodeIndexPopover.tsx`       | Added LiteLLM UI section for embedding configuration      |
| `src/i18n/locales/en/embeddings.json`                       | Added i18n keys for LiteLLM embedding                     |
| `src/i18n/locales/th/embeddings.json`                       | Added Thai translations                                   |
| `webview-ui/src/i18n/locales/en/settings.json`              | Added UI i18n keys                                        |
| `webview-ui/src/i18n/locales/th/settings.json`              | Added Thai UI translations                                |
| `src/services/code-index/__tests__/service-factory.spec.ts` | Added 4 test cases for litellm embedder creation          |
| `src/services/code-index/__tests__/config-manager.spec.ts`  | Added 3 test cases for litellm config handling            |

## Test Results

All tests pass — 155+ tests across 4 test files:

| Test File                                                         | Tests |
| ----------------------------------------------------------------- | ----- |
| `src/services/code-index/embedders/__tests__/litellm.spec.ts`     | 13    |
| `src/services/code-index/__tests__/litellm-model-fetcher.spec.ts` | 23    |
| `src/services/code-index/__tests__/service-factory.spec.ts`       | 4 new |
| `src/services/code-index/__tests__/config-manager.spec.ts`        | 3 new |
