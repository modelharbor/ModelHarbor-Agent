import { OpenAI } from "openai"
import { IEmbedder, EmbeddingResponse, EmbedderInfo } from "../interfaces/embedder"
import {
	MAX_BATCH_TOKENS,
	MAX_ITEM_TOKENS,
	MAX_BATCH_RETRIES as MAX_RETRIES,
	INITIAL_RETRY_DELAY_MS as INITIAL_DELAY_MS,
} from "../constants"

/**
 * ModelHarbor implementation of the embedder interface with batching and rate limiting.
 * Uses the ModelHarbor API for creating embeddings with the baai/bge-m3 model.
 */
export class ModelHarborEmbedder implements IEmbedder {
	private embeddingsClient: OpenAI
	private readonly modelId: string = "baai/bge-m3"
	private readonly baseUrl: string = "https://api.modelharbor.com"

	/**
	 * Creates a new ModelHarbor embedder
	 * @param apiKey The API key for ModelHarbor authentication
	 */
	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error("API key is required for ModelHarbor embedder")
		}

		this.embeddingsClient = new OpenAI({
			baseURL: this.baseUrl,
			apiKey: apiKey,
		})
	}

	/**
	 * Creates embeddings for the given texts with batching and rate limiting
	 * @param texts Array of text strings to embed
	 * @param model Optional model identifier (ignored, always uses baai/bge-m3)
	 * @returns Promise resolving to embedding response
	 */
	async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse> {
		const modelToUse = this.modelId // Always use baai/bge-m3
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
						`Text at index ${i} exceeds maximum token limit (${itemTokens} > ${MAX_ITEM_TOKENS}). Skipping.`,
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
				try {
					const batchResult = await this._embedBatchWithRetries(currentBatch, modelToUse)
					allEmbeddings.push(...batchResult.embeddings)
					usage.promptTokens += batchResult.usage.promptTokens
					usage.totalTokens += batchResult.usage.totalTokens
				} catch (error) {
					console.error("Failed to process batch:", error)
					throw new Error("Failed to create embeddings: batch processing error")
				}
			}
		}

		return { embeddings: allEmbeddings, usage }
	}

	/**
	 * Helper method to handle batch embedding with retries and exponential backoff
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
				const response = await this.embeddingsClient.embeddings.create({
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
				const isRateLimitError = error?.status === 429
				const hasMoreAttempts = attempts < MAX_RETRIES - 1

				if (isRateLimitError && hasMoreAttempts) {
					const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
					console.warn(`Rate limit hit, retrying in ${delayMs}ms (attempt ${attempts + 1}/${MAX_RETRIES})`)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
					continue
				}

				// Log the error for debugging only on final attempt
				if (!hasMoreAttempts) {
					console.error(`ModelHarbor embedder error (attempt ${attempts + 1}/${MAX_RETRIES}):`, error)
					throw new Error(
						`Failed to create embeddings after ${MAX_RETRIES} attempts: ${error.message || error}`,
					)
				}

				// For non-rate-limit errors, wait before retry
				if (hasMoreAttempts) {
					const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempts)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
				}
			}
		}

		throw new Error(`Failed to create embeddings after ${MAX_RETRIES} attempts`)
	}

	/**
	 * Returns information about this embedder
	 */
	get embedderInfo(): EmbedderInfo {
		return {
			name: "modelharbor",
		}
	}
}
