import { OpenAI } from "openai"
import type { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"
import { withValidationErrorHandling, formatEmbeddingError, HttpError } from "../shared/validation-helpers"
import { t } from "../../../i18n"

/**
 * Standalone LiteLLM embedder implementation with batching and retry logic.
 * Uses the LiteLLM proxy's OpenAI-compatible `/v1/embeddings` endpoint.
 *
 * LiteLLM provides an OpenAI-compatible proxy that can route embedding requests
 * to various providers. The baseUrl is required and points to the user's
 * LiteLLM proxy instance.
 *
 * Key differences from OpenAICompatibleEmbedder:
 * - Does NOT send `encoding_format` (avoids HTTP 400 from backends that don't support it)
 * - Appends `/v1` to baseUrl if not already present
 * - Uses `"dummy-key"` when no API key is provided
 * - Validates embedding dimension consistency within batches
 * - Supports `detectDimension()` for auto-detecting embedding size
 */
export class LiteLLMEmbedder implements IEmbedder {
	private client: OpenAI
	private readonly model: string
	private readonly normalizedBaseUrl: string
	private readonly apiKey: string
	private readonly dimension?: number

	/**
	 * Creates a new LiteLLM embedder
	 * @param baseUrl The LiteLLM proxy base URL (e.g. "http://localhost:4000")
	 * @param modelId The model ID to use for embeddings
	 * @param apiKey Optional API key for authentication (some LiteLLM setups don't require one)
	 * @param dimension Optional known embedding dimension
	 */
	constructor(baseUrl: string, modelId: string, apiKey?: string, dimension?: number) {
		if (!baseUrl) {
			throw new Error(t("embeddings:validation.baseUrlRequired"))
		}

		// Normalize URL: strip trailing slash, then append /v1 if not present
		let normalizedUrl = baseUrl.replace(/\/$/, "")
		if (!normalizedUrl.endsWith("/v1")) {
			normalizedUrl += "/v1"
		}
		this.normalizedBaseUrl = normalizedUrl
		this.apiKey = apiKey || "dummy-key"
		this.model = modelId
		this.dimension = dimension

		this.client = new OpenAI({
			baseURL: this.normalizedBaseUrl,
			apiKey: this.apiKey,
		})
	}

	/**
	 * Creates embeddings for the given texts with batching and retry logic.
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (uses constructor model if not provided)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = model || this.model

		try {
			const allEmbeddings: number[][] = []
			const usage = { promptTokens: 0, totalTokens: 0 }
			const remainingTexts = [...texts]

			while (remainingTexts.length > 0) {
				const currentBatch: string[] = []
				let currentBatchTokens = 0
				const processedIndices: number[] = []

				for (let i = 0; i < remainingTexts.length; i++) {
					const text = remainingTexts[i]
					const itemTokens = Math.ceil(text.length / 4)

					if (itemTokens > MAX_ITEM_TOKENS) {
						console.warn(
							t("embeddings:textExceedsTokenLimit", {
								index: i,
								itemTokens,
								maxTokens: MAX_ITEM_TOKENS,
							}),
						)
						processedIndices.push(i)
						continue
					}

					if (currentBatchTokens + itemTokens <= MAX_BATCH_TOKENS) {
						currentBatch.push(text)
						currentBatchTokens += itemTokens
						processedIndices.push(i)
					} else {
						break
					}
				}

				// Remove processed items from remainingTexts (in reverse order to maintain correct indices)
				for (let i = processedIndices.length - 1; i >= 0; i--) {
					remainingTexts.splice(processedIndices[i], 1)
				}

				if (currentBatch.length > 0) {
					const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)

					// Validate embedding dimensions are consistent
					if (batchResult.embeddings.length > 0) {
						const batchDimension = batchResult.embeddings[0].length
						console.log(
							`[LiteLLMEmbedder] Generated embeddings with dimension: ${batchDimension} for model: ${modelToUse}`,
						)

						// Check all embeddings have the same dimension
						for (let i = 1; i < batchResult.embeddings.length; i++) {
							if (batchResult.embeddings[i].length !== batchDimension) {
								throw new Error(
									`Inconsistent embedding dimensions: expected ${batchDimension}, got ${batchResult.embeddings[i].length}`,
								)
							}
						}
					}

					allEmbeddings.push(...batchResult.embeddings)
					usage.promptTokens += batchResult.usage.promptTokens
					usage.totalTokens += batchResult.usage.totalTokens
				}
			}

			return { embeddings: allEmbeddings, usage }
		} catch (error) {
			console.error("Failed to process batch:", error)
			throw new Error(
				`Failed to create embeddings: batch processing error - ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Helper method to handle batch embedding with retries and exponential backoff.
	 * Does NOT send encoding_format to avoid HTTP 400 from backends that don't support it.
	 * @param batchTexts Array of texts to embed in this batch
	 * @param model Model identifier to use
	 * @returns Promise resolving to embeddings and usage statistics
	 */
	private async _embedBatchWithRetries(
		batchTexts: string[],
		model: string,
	): Promise<{ embeddings: number[][]; usage: { promptTokens: number; totalTokens: number } }> {
		for (let attempts = 0; attempts < MAX_RETRIES; attempts++) {
			try {
				const response = await this.client.embeddings.create({
					input: batchTexts,
					model: model,
				})

				return {
					embeddings: response.data.map((item) => item.embedding),
					usage: {
						promptTokens: response.usage?.prompt_tokens || 0,
						totalTokens: response.usage?.total_tokens || 0,
					},
				}
			} catch (error: any) {
				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				// Check if it's a rate limit error
				const httpError = error as HttpError
				if (httpError?.status === 429 && hasMoreAttempts) {
					const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
					console.warn(
						t("embeddings:rateLimitRetry", {
							delayMs,
							attempt: attempts + 1,
							maxRetries: MAX_RETRIES,
						}),
					)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				// Log the error for debugging
				console.error(`LiteLLM embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)

				// Format and throw the error
				throw formatEmbeddingError(error, MAX_RETRIES)
			}
		}

		throw new Error(t("embeddings:failedMaxAttempts", { attempts: MAX_RETRIES }))
	}

	/**
	 * Validates the LiteLLM embedder configuration by attempting a minimal embedding request.
	 * @returns Promise resolving to validation result with success status and optional error message
	 */
	async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
		return withValidationErrorHandling(async () => {
			// Test with a minimal embedding request
			const response = await this.client.embeddings.create({
				input: ["test"],
				model: this.model,
			})

			// Check if we got a valid response
			if (!response.data || response.data.length === 0) {
				return {
					valid: false,
					error: t("embeddings:validation.invalidEndpoint"),
				}
			}

			// Log the actual dimension for debugging
			const actualDimension = response.data[0]?.embedding?.length
			if (actualDimension) {
				console.log(`[LiteLLMEmbedder] Model ${this.model} has dimension: ${actualDimension}`)
			}

			return { valid: true }
		}, "litellm")
	}

	/**
	 * Detects the actual embedding dimension by sending a test embedding request.
	 * @returns Promise resolving to the detected dimension, or undefined if detection fails
	 */
	async detectDimension(): Promise<number | undefined> {
		try {
			const response = await this.client.embeddings.create({
				input: "test",
				model: this.model,
			})

			if (response.data && response.data.length > 0) {
				const embedding = response.data[0].embedding
				if (Array.isArray(embedding)) {
					const dimension = embedding.length
					console.log(`[LiteLLMEmbedder] Auto-detected embedding dimension: ${dimension}`)
					return dimension
				}
				// Handle base64 string (some backends may still return base64)
				if (typeof embedding === "string") {
					const buffer = Buffer.from(embedding as string, "base64")
					const dimension = buffer.byteLength / 4
					console.log(`[LiteLLMEmbedder] Auto-detected embedding dimension (from base64): ${dimension}`)
					return dimension
				}
			}
			return undefined
		} catch (error) {
			console.log(
				`[LiteLLMEmbedder] Failed to detect dimension: ${error instanceof Error ? error.message : String(error)}`,
			)
			return undefined
		}
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "litellm",
		}
	}
}
