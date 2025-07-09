import { ModelHarborEmbedder } from "../modelharbor"
import { getModelDimension } from "../../../../shared/embeddingModels"
import { OpenAI } from "openai"

// Mock the OpenAI client
vi.mock("openai", () => {
	return {
		OpenAI: vi.fn(),
	}
})

describe("ModelHarborEmbedder", () => {
	let embedder: ModelHarborEmbedder
	let mockCreate: any

	beforeEach(() => {
		mockCreate = vi.fn()
		vi.mocked(OpenAI).mockImplementation(
			() =>
				({
					embeddings: {
						create: mockCreate,
					},
				}) as any,
		)
		embedder = new ModelHarborEmbedder("test-api-key")
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should throw error when API key is missing", () => {
			expect(() => new ModelHarborEmbedder("")).toThrow("API key is required for ModelHarbor embedder")
		})

		it("should create embedder with valid API key", () => {
			expect(() => new ModelHarborEmbedder("valid-key")).not.toThrow()
		})
	})

	describe("createEmbeddings", () => {
		it("should create embeddings successfully", async () => {
			const mockEmbedding = new Array(1024).fill(0.1) // 1024 dimensions for bge-m3
			mockCreate.mockResolvedValue({
				data: [{ embedding: mockEmbedding }, { embedding: mockEmbedding }],
				usage: {
					prompt_tokens: 10,
					total_tokens: 15,
				},
			})

			const result = await embedder.createEmbeddings(["test text 1", "test text 2"])

			expect(result).toEqual({
				embeddings: [mockEmbedding, mockEmbedding],
				usage: {
					promptTokens: 10,
					totalTokens: 15,
				},
			})
			expect(mockCreate).toHaveBeenCalledWith({
				input: ["test text 1", "test text 2"],
				model: "baai/bge-m3",
			})
		})

		it("should handle rate limiting with retries", async () => {
			const mockEmbedding = new Array(1024).fill(0.1)

			// First call fails with rate limit, second succeeds
			mockCreate.mockRejectedValueOnce({ status: 429, message: "Rate limit exceeded" }).mockResolvedValueOnce({
				data: [{ embedding: mockEmbedding }],
				usage: { prompt_tokens: 5, total_tokens: 8 },
			})

			const result = await embedder.createEmbeddings(["test text"])

			expect(result.embeddings).toEqual([mockEmbedding])
			expect(mockCreate).toHaveBeenCalledTimes(2)
		})

		it("should process large batches correctly", async () => {
			const mockEmbedding = new Array(1024).fill(0.1)
			const largeTexts = new Array(100).fill("test text")

			mockCreate.mockResolvedValue({
				data: largeTexts.map(() => ({ embedding: mockEmbedding })),
				usage: { prompt_tokens: 100, total_tokens: 150 },
			})

			const result = await embedder.createEmbeddings(largeTexts)

			expect(result.embeddings).toHaveLength(100)
			expect(result.embeddings[0]).toEqual(mockEmbedding)
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			const info = embedder.embedderInfo
			expect(info.name).toBe("modelharbor")
		})
	})

	describe("dimension configuration", () => {
		it("should have correct dimension in shared config", () => {
			const dimension = getModelDimension("modelharbor", "baai/bge-m3")
			expect(dimension).toBe(1024)
		})
	})
})
