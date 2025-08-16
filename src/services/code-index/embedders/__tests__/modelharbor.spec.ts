import { describe, it, expect, beforeEach, vi } from "vitest"
import { ModelHarborEmbedder } from "../modelharbor"

// Mock fetch for HTTP requests
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("ModelHarborEmbedder", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should create embedder with API key", () => {
			// Arrange & Act
			const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "test-api-key" })

			// Assert
			expect(embedder.embedderInfo.name).toBe("modelharbor")
		})

		it("should create embedder with custom model ID", () => {
			// Arrange & Act
			const embedder = new ModelHarborEmbedder({
				modelHarborApiKey: "test-api-key",
				modelHarborEmbeddingModelId: "custom-model",
			})

			// Assert
			expect(embedder.embedderInfo.name).toBe("modelharbor")
		})

		it("should throw error when API key is missing", () => {
			// Act & Assert
			expect(() => new ModelHarborEmbedder({ modelHarborApiKey: "" })).toThrow("validation.apiKeyRequired")
			expect(() => new ModelHarborEmbedder({ modelHarborApiKey: null as any })).toThrow(
				"validation.apiKeyRequired",
			)
			expect(() => new ModelHarborEmbedder({ modelHarborApiKey: undefined })).toThrow("validation.apiKeyRequired")
		})
	})

	describe("createEmbeddings", () => {
		describe("successful requests", () => {
			it("should embed text successfully with default model", async () => {
				// Arrange
				const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "test-api-key" })
				const texts = ["Hello world", "Another text"]

				// Mock successful response
				const mockResponse = {
					data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
					usage: { prompt_tokens: 10, total_tokens: 15 },
				}

				// Mock the OpenAI embeddings.create method
				vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockResolvedValue(mockResponse as any)

				// Act
				const result = await embedder.createEmbeddings(texts)

				// Assert
				expect(result.embeddings).toHaveLength(2)
				expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
				expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6])
				expect(result.usage?.promptTokens).toBe(10)
				expect(result.usage?.totalTokens).toBe(15)
			})

			it("should embed text successfully with custom model", async () => {
				// Arrange
				const customModel = "custom-model"
				const embedder = new ModelHarborEmbedder({
					modelHarborApiKey: "test-api-key",
					modelHarborEmbeddingModelId: customModel,
				})
				const texts = ["Test text"]

				// Mock successful response
				const mockResponse = {
					data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }],
					usage: { prompt_tokens: 5, total_tokens: 8 },
				}

				vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockResolvedValue(mockResponse as any)

				// Act
				const result = await embedder.createEmbeddings(texts)

				// Assert
				expect(result.embeddings).toHaveLength(1)
				expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3, 0.4])
				expect(result.usage?.promptTokens).toBe(5)
				expect(result.usage?.totalTokens).toBe(8)

				// Verify the correct model was used
				expect(embedder["embeddingsClient"].embeddings.create).toHaveBeenCalledWith({
					input: texts,
					model: customModel,
				})
			})

			it("should handle API error responses", async () => {
				// Arrange
				const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "test-api-key" })
				const texts = ["Test text"]

				// Mock API error
				const apiError = new Error("Bad Request")
				;(apiError as any).status = 400
				vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockRejectedValue(apiError)

				// Act & Assert
				await expect(embedder.createEmbeddings(texts)).rejects.toThrow(
					"Failed to create embeddings: batch processing error",
				)
			})
		})
	})

	describe("validateConfiguration", () => {
		it("should validate successfully with valid API key", async () => {
			// Arrange
			const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "valid-api-key" })

			// Mock successful validation response
			const mockResponse = {
				data: [{ embedding: [0.1, 0.2, 0.3] }],
			}
			vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockResolvedValue(mockResponse as any)

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(true)
			expect(embedder["embeddingsClient"].embeddings.create).toHaveBeenCalledWith({
				input: ["test"],
				model: "baai/bge-m3",
			})
		})

		it("should fail validation with authentication error", async () => {
			// Arrange
			const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "invalid-api-key" })

			// Mock authentication error
			const authError = new Error("Unauthorized")
			;(authError as any).status = 401
			vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockRejectedValue(authError)

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toBe("validation.authenticationFailed")
		})

		it("should fail validation with connection error", async () => {
			// Arrange
			const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "test-api-key" })

			// Mock connection error
			const connectionError = new Error("ECONNREFUSED")
			vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockRejectedValue(connectionError)

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toBe("validation.connectionFailed")
		})

		it("should fail validation with generic error", async () => {
			// Arrange
			const embedder = new ModelHarborEmbedder({ modelHarborApiKey: "test-api-key" })

			// Mock generic error
			const genericError = new Error("Unknown error")
			vi.spyOn(embedder["embeddingsClient"].embeddings, "create").mockRejectedValue(genericError)

			// Act
			const result = await embedder.validateConfiguration()

			// Assert
			expect(result.valid).toBe(false)
			expect(result.error).toBe("validation.configurationError")
		})
	})
})
