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

describe("ModelHarborEmbedder", () => {
	let embedder: ModelHarborEmbedder
	const mockApiKey = "test-api-key"

	beforeEach(() => {
		embedder = new ModelHarborEmbedder(mockApiKey)
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
				model: "baai/bge-m3",
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

		it("should use fixed model ID regardless of input", async () => {
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
			await embedder.createEmbeddings(texts, "some-other-model")

			expect(mockCreate).toHaveBeenCalledWith({
				input: texts,
				model: "baai/bge-m3", // Should always use baai/bge-m3
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
				expect.stringContaining("ModelHarbor embedder error (attempt 3/3)"),
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
				model: "baai/bge-m3",
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
