import { ModelHarborEmbedder } from "../modelharbor"
import { MAX_ITEM_TOKENS } from "../../constants"

// Mock the OpenAI library
vi.mock("openai", () => {
	return {
		OpenAI: vi.fn().mockImplementation(() => ({
			embeddings: {
				create: vi.fn(),
			},
		})),
	}
})

// Mock the i18n function
vi.mock("../../../../i18n", () => ({
	t: vi.fn((key: string, params?: any) => {
		if (key === "embeddings:rateLimitRetry") {
			return `Rate limit hit, retrying in ${params.delayMs}ms (attempt ${params.attempt}/${params.maxRetries})`
		}
		if (key === "embeddings:textExceedsTokenLimit") {
			return `Text at index ${params.index} exceeds maximum token limit (${params.itemTokens} > ${params.maxTokens}). Skipping.`
		}
		if (key === "embeddings:textWithPrefixExceedsTokenLimit") {
			return `Text with prefix at index ${params.index} exceeds maximum token limit (${params.estimatedTokens} > ${params.maxTokens}). Skipping.`
		}
		if (key === "embeddings:failedMaxAttempts") {
			return `Failed to create embeddings after ${params.attempts} attempts`
		}
		if (key === "embeddings:modelharbor.invalidResponseFormat") {
			return "Invalid response format from ModelHarbor"
		}
		return key
	}),
}))

// Mock the embedding models
vi.mock("../../../../shared/embeddingModels", () => ({
	getModelQueryPrefix: vi.fn().mockReturnValue(undefined),
}))

// Mock the validation helpers
vi.mock("../../shared/validation-helpers", () => ({
	withValidationErrorHandling: vi.fn().mockImplementation(async (fn, provider) => {
		try {
			return await fn()
		} catch (error) {
			return { valid: false, error: "failedWithError" }
		}
	}),
	formatEmbeddingError: vi.fn().mockImplementation((error, maxRetries) => {
		const errorMessage = error.message || error
		return new Error(`failedWithError`)
	}),
}))

describe("ModelHarborEmbedder", () => {
	let embedder: ModelHarborEmbedder
	const mockApiKey = "test-api-key"
	const mockModelId = "baai/bge-m3"

	beforeEach(() => {
		embedder = new ModelHarborEmbedder(mockApiKey, mockModelId)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should create an instance with valid API key", () => {
			expect(embedder).toBeInstanceOf(ModelHarborEmbedder)
			expect(embedder.embedderInfo.name).toBe("modelharbor")
		})

		it("should throw error when API key is empty", () => {
			expect(() => new ModelHarborEmbedder("")).toThrow("API key is required for ModelHarbor embedder")
		})

		it("should throw error when API key is undefined", () => {
			expect(() => new ModelHarborEmbedder(undefined as any)).toThrow(
				"API key is required for ModelHarbor embedder",
			)
		})
	})

	describe("createEmbeddings", () => {
		it("should create embeddings successfully", async () => {
			const mockEmbeddingsResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			}

			// Mock the OpenAI client's create method
			const mockCreate = vi.fn().mockResolvedValue(mockEmbeddingsResponse)
			;(embedder as any).embeddingsClient.embeddings.create = mockCreate

			const texts = ["hello world", "test text"]
			const result = await embedder.createEmbeddings(texts)

			expect(mockCreate).toHaveBeenCalledWith({
				input: texts,
				model: mockModelId,
			})

			expect(result).toEqual({
				embeddings: [
					[0.1, 0.2, 0.3],
					[0.4, 0.5, 0.6],
				],
				usage: {
					promptTokens: 10,
					totalTokens: 10,
				},
			})
		})

		it("should use provided model ID when specified", async () => {
			const mockEmbeddingsResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: {
					prompt_tokens: 5,
					total_tokens: 5,
				},
			}

			const mockCreate = vi.fn().mockResolvedValue(mockEmbeddingsResponse)
			;(embedder as any).embeddingsClient.embeddings.create = mockCreate

			const texts = ["test"]
			const customModel = "some-other-model"
			await embedder.createEmbeddings(texts, customModel)

			expect(mockCreate).toHaveBeenCalledWith({
				input: texts,
				model: customModel, // Should use the provided model
			})
		})

		it("should use constructor model ID when no model is provided", async () => {
			const mockEmbeddingsResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: {
					prompt_tokens: 5,
					total_tokens: 5,
				},
			}

			const mockCreate = vi.fn().mockResolvedValue(mockEmbeddingsResponse)
			;(embedder as any).embeddingsClient.embeddings.create = mockCreate

			const texts = ["test"]
			await embedder.createEmbeddings(texts) // No model provided

			expect(mockCreate).toHaveBeenCalledWith({
				input: texts,
				model: mockModelId, // Should fall back to constructor model ID
			})
		})

		it("should handle rate limiting with retries", async () => {
			const rateLimitError = new Error("Rate limit exceeded")
			;(rateLimitError as any).status = 429

			const mockCreate = vi
				.fn()
				.mockRejectedValueOnce(rateLimitError)
				.mockRejectedValueOnce(rateLimitError)
				.mockResolvedValueOnce({
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: { prompt_tokens: 5, total_tokens: 5 },
				})

			;(embedder as any).embeddingsClient.embeddings.create = mockCreate

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = await embedder.createEmbeddings(["test"])

			expect(mockCreate).toHaveBeenCalledTimes(3)
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Rate limit hit, retrying in"))
			expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]])

			consoleSpy.mockRestore()
		})

		it("should throw error after max retries", async () => {
			const error = new Error("API error")
			const mockCreate = vi.fn().mockRejectedValue(error)
			;(embedder as any).embeddingsClient.embeddings.create = mockCreate

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			await expect(embedder.createEmbeddings(["test"])).rejects.toThrow(
				"Failed to create embeddings: batch processing error",
			)

			// Should only log error on final attempt
			expect(consoleSpy).toHaveBeenCalledTimes(2) // One from final retry attempt, one from batch processing
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("ModelHarbor embedder error (attempt"),
				error,
			)
			expect(consoleSpy).toHaveBeenCalledWith("Failed to process batch:", expect.any(Error))

			consoleSpy.mockRestore()
		})

		it("should handle batching correctly for large inputs", async () => {
			const mockEmbeddingsResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 5 },
			}

			const mockCreate = vi.fn().mockResolvedValue(mockEmbeddingsResponse)
			;(embedder as any).embeddingsClient.embeddings.create = mockCreate

			// Create a large text that exceeds token limits (MAX_ITEM_TOKENS = 8191)
			// Each character is estimated as 1/4 token, so create text longer than MAX_ITEM_TOKENS * 4
			const largeText = "x".repeat(MAX_ITEM_TOKENS * 5) // This should exceed MAX_ITEM_TOKENS
			const normalText = "normal text"

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			const result = await embedder.createEmbeddings([largeText, normalText])

			// Should warn about skipping large text
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("exceeds maximum token limit"))

			// Should only process the normal text
			expect(mockCreate).toHaveBeenCalledWith({
				input: [normalText],
				model: mockModelId,
			})

			consoleSpy.mockRestore()
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			const info = embedder.embedderInfo
			expect(info.name).toBe("modelharbor")
		})
	})
})
