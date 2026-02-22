import { OpenAI } from "openai"
import { LiteLLMEmbedder } from "../litellm"
import { MAX_ITEM_TOKENS, MAX_BATCH_TOKENS, INITIAL_RETRY_DELAY_MS } from "../../constants"

// Mock the OpenAI SDK
vitest.mock("openai")

// Mock TelemetryService
vitest.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureEvent: vitest.fn(),
		},
	},
}))

// Mock i18n
vitest.mock("../../../../i18n", () => ({
	t: (key: string, params?: Record<string, any>) => {
		const translations: Record<string, string> = {
			"embeddings:validation.baseUrlRequired": "Base URL is required",
			"embeddings:validation.authenticationFailed": "Authentication failed",
			"embeddings:validation.connectionFailed": "Connection failed",
			"embeddings:validation.invalidEndpoint": "Invalid endpoint",
			"embeddings:validation.configurationError": "Configuration error",
			"embeddings:textExceedsTokenLimit":
				"Text at index {{index}} exceeds max token limit ({{itemTokens}} > {{maxTokens}})",
			"embeddings:rateLimitRetry": "Rate limited, retrying in {{delayMs}}ms (attempt {{attempt}}/{{maxRetries}})",
			"embeddings:failedMaxAttempts": "Failed after {{attempts}} attempts",
			"embeddings:authenticationFailed": "Authentication failed",
			"embeddings:failedWithStatus":
				"Failed after {{attempts}} attempts with status {{statusCode}}: {{errorMessage}}",
			"embeddings:failedWithError": "Failed after {{attempts}} attempts: {{errorMessage}}",
		}
		let result = translations[key] || key
		if (params) {
			Object.entries(params).forEach(([param, value]) => {
				result = result.replace(new RegExp(`{{${param}}}`, "g"), String(value))
			})
		}
		return result
	},
}))

// Mock serialize-error
vitest.mock("serialize-error", () => ({
	serializeError: (error: any) => {
		if (error instanceof Error) {
			return { message: error.message, name: error.name, status: (error as any).status }
		}
		return error
	},
}))

const MockedOpenAI = OpenAI as any

describe("LiteLLMEmbedder", () => {
	let mockEmbeddingsCreate: ReturnType<typeof vitest.fn>

	beforeEach(() => {
		vitest.clearAllMocks()
		vitest.spyOn(console, "log").mockImplementation(() => {})
		vitest.spyOn(console, "warn").mockImplementation(() => {})
		vitest.spyOn(console, "error").mockImplementation(() => {})

		mockEmbeddingsCreate = vitest.fn()
		MockedOpenAI.mockImplementation(() => ({
			embeddings: {
				create: mockEmbeddingsCreate,
			},
		}))
	})

	afterEach(() => {
		vitest.restoreAllMocks()
	})

	describe("constructor", () => {
		it("should create an instance with baseUrl that already ends with /v1", () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000/v1", "baai/bge-m3", "test-api-key")

			expect(MockedOpenAI).toHaveBeenCalledWith({
				baseURL: "http://localhost:4000/v1",
				apiKey: "test-api-key",
			})
			expect(embedder.embedderInfo.name).toBe("litellm")
		})

		it("should append /v1 when baseUrl does not end with /v1", () => {
			new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3", "test-api-key")

			expect(MockedOpenAI).toHaveBeenCalledWith({
				baseURL: "http://localhost:4000/v1",
				apiKey: "test-api-key",
			})
		})

		it("should normalize trailing slash before appending /v1", () => {
			new LiteLLMEmbedder("http://localhost:4000/", "baai/bge-m3")

			expect(MockedOpenAI).toHaveBeenCalledWith({
				baseURL: "http://localhost:4000/v1",
				apiKey: "dummy-key",
			})
		})

		it("should use 'dummy-key' when apiKey is not provided", () => {
			new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")

			expect(MockedOpenAI).toHaveBeenCalledWith({
				baseURL: "http://localhost:4000/v1",
				apiKey: "dummy-key",
			})
		})

		it("should use provided apiKey when given", () => {
			new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3", "sk-my-litellm-key")

			expect(MockedOpenAI).toHaveBeenCalledWith({
				baseURL: "http://localhost:4000/v1",
				apiKey: "sk-my-litellm-key",
			})
		})

		it("should throw error when baseUrl is empty", () => {
			expect(() => new LiteLLMEmbedder("", "model-id")).toThrow("Base URL is required")
		})
	})

	describe("embedderInfo", () => {
		it("should return correct embedder info", () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")

			expect(embedder.embedderInfo).toEqual({ name: "litellm" })
		})
	})

	describe("createEmbeddings", () => {
		it("should embed texts successfully", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
				usage: { prompt_tokens: 10, total_tokens: 15 },
			})

			const result = await embedder.createEmbeddings(["text1", "text2"])

			expect(result.embeddings).toEqual([
				[0.1, 0.2, 0.3],
				[0.4, 0.5, 0.6],
			])
			expect(result.usage).toEqual({ promptTokens: 10, totalTokens: 15 })
		})

		it("should use instance model when no model parameter provided", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 8 },
			})

			await embedder.createEmbeddings(["test"])

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: ["test"],
				model: "baai/bge-m3",
			})
		})

		it("should use provided model parameter when specified", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 8 },
			})

			await embedder.createEmbeddings(["test"], "qwen/qwen3-embedding-4b")

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: ["test"],
				model: "qwen/qwen3-embedding-4b",
			})
		})

		it("should NOT send encoding_format in request", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 8 },
			})

			await embedder.createEmbeddings(["test"])

			const callArgs = mockEmbeddingsCreate.mock.calls[0][0]
			expect(callArgs).not.toHaveProperty("encoding_format")
			expect(callArgs).toEqual({ input: ["test"], model: "baai/bge-m3" })
		})

		it("should log dimension when embeddings have consistent dimensions", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
				usage: { prompt_tokens: 10, total_tokens: 15 },
			})

			await embedder.createEmbeddings(["text1", "text2"])

			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Generated embeddings with dimension: 3"))
		})

		it("should throw error when embeddings have inconsistent dimensions", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5] }],
				usage: { prompt_tokens: 10, total_tokens: 15 },
			})

			await expect(embedder.createEmbeddings(["text1", "text2"])).rejects.toThrow(
				"Failed to create embeddings: batch processing error - Inconsistent embedding dimensions: expected 3, got 2",
			)
		})

		it("should wrap batch errors with context message", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			const error = new Error("Some API error")
			mockEmbeddingsCreate.mockRejectedValue(error)

			await expect(embedder.createEmbeddings(["test"])).rejects.toThrow(
				"Failed to create embeddings: batch processing error",
			)
		})

		it("should wrap non-Error batch errors with String conversion", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockRejectedValue("string error")

			await expect(embedder.createEmbeddings(["test"])).rejects.toThrow(
				"Failed to create embeddings: batch processing error",
			)
		})

		it("should handle empty text array", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")

			const result = await embedder.createEmbeddings([])

			expect(result.embeddings).toEqual([])
			expect(result.usage).toEqual({ promptTokens: 0, totalTokens: 0 })
			expect(mockEmbeddingsCreate).not.toHaveBeenCalled()
		})

		it("should warn and skip texts exceeding maximum token limit", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			const oversizedText = "a".repeat(MAX_ITEM_TOKENS * 4 + 100)
			const normalText = "normal text"

			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
				usage: { prompt_tokens: 5, total_tokens: 8 },
			})

			const result = await embedder.createEmbeddings([normalText, oversizedText])

			// Should only embed the normal text
			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: [normalText],
				model: "baai/bge-m3",
			})
			expect(result.embeddings).toHaveLength(1)
			expect(console.warn).toHaveBeenCalled()
		})

		it("should batch texts when exceeding MAX_BATCH_TOKENS", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			// Each text needs ~8000 tokens (32000 chars / 4)
			const tokensPerText = 8000
			const charsPerText = tokensPerText * 4
			const numTexts = Math.ceil(MAX_BATCH_TOKENS / tokensPerText) + 2

			const texts = Array.from({ length: numTexts }, (_, i) => `text${i}${"a".repeat(charsPerText)}`)

			let callCount = 0
			mockEmbeddingsCreate.mockImplementation(async (args: any) => {
				callCount++
				return {
					data: args.input.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
					usage: { prompt_tokens: 10, total_tokens: 15 },
				}
			})

			const result = await embedder.createEmbeddings(texts)

			// Should have been called multiple times due to batching
			expect(callCount).toBeGreaterThan(1)
			expect(result.embeddings).toHaveLength(numTexts)
		})
	})

	describe("retry logic", () => {
		it("should retry on 429 rate limit errors with exponential backoff", async () => {
			vitest.useFakeTimers()
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")

			const rateLimitError = new Error("Rate limited") as any
			rateLimitError.status = 429

			mockEmbeddingsCreate
				.mockRejectedValueOnce(rateLimitError)
				.mockRejectedValueOnce(rateLimitError)
				.mockResolvedValueOnce({
					data: [{ embedding: [0.1, 0.2, 0.3] }],
					usage: { prompt_tokens: 5, total_tokens: 8 },
				})

			const promise = embedder.createEmbeddings(["test"])

			// Fast-forward through the delays
			await vitest.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS) // First retry delay
			await vitest.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY_MS * 2) // Second retry delay

			const result = await promise

			expect(result.embeddings).toEqual([[0.1, 0.2, 0.3]])
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(3)

			vitest.useRealTimers()
		})

		it("should throw after max retries on 429 errors", async () => {
			vitest.useFakeTimers()
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")

			const rateLimitError = new Error("Rate limited") as any
			rateLimitError.status = 429

			mockEmbeddingsCreate.mockRejectedValue(rateLimitError)

			// Capture the promise and immediately attach a catch handler to prevent unhandled rejection
			let caughtError: Error | undefined
			const promise = embedder.createEmbeddings(["test"]).catch((e: Error) => {
				caughtError = e
			})

			// Run all pending timers to exhaust retries
			await vitest.runAllTimersAsync()
			await promise

			expect(caughtError).toBeDefined()
			expect(caughtError!.message).toContain("Failed to create embeddings: batch processing error")
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(3)

			vitest.useRealTimers()
		})

		it("should not retry on non-429 errors", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")

			const serverError = new Error("Internal Server Error") as any
			serverError.status = 500

			mockEmbeddingsCreate.mockRejectedValue(serverError)

			await expect(embedder.createEmbeddings(["test"])).rejects.toThrow(
				"Failed to create embeddings: batch processing error",
			)

			// Should only be called once (no retries)
			expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1)
		})
	})

	describe("detectDimension", () => {
		it("should return dimension from array embedding response", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3", "test-key")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
			})

			const dimension = await embedder.detectDimension()

			expect(dimension).toBe(5)
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Auto-detected embedding dimension: 5"))
		})

		it("should return dimension from base64 embedding response", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			const testEmbedding = new Float32Array([0.25, 0.5, 0.75, 1.0])
			const base64String = Buffer.from(testEmbedding.buffer).toString("base64")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: base64String }],
			})

			const dimension = await embedder.detectDimension()

			expect(dimension).toBe(4)
			expect(console.log).toHaveBeenCalledWith(
				expect.stringContaining("Auto-detected embedding dimension (from base64): 4"),
			)
		})

		it("should return undefined when response has no data", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({ data: [] })

			const dimension = await embedder.detectDimension()

			expect(dimension).toBeUndefined()
		})

		it("should return undefined when API call fails", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockRejectedValue(new Error("API error"))

			const dimension = await embedder.detectDimension()

			expect(dimension).toBeUndefined()
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Failed to detect dimension: API error"))
		})

		it("should send correct model in the embedding request", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
			})

			await embedder.detectDimension()

			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: "test",
				model: "baai/bge-m3",
			})
		})
	})

	describe("validateConfiguration", () => {
		it("should validate successfully with valid configuration", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({
				data: [{ embedding: [0.1, 0.2, 0.3] }],
			})

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(true)
			expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
				input: ["test"],
				model: "baai/bge-m3",
			})
		})

		it("should fail validation when response has no data", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			mockEmbeddingsCreate.mockResolvedValue({ data: [] })

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("Invalid endpoint")
		})

		it("should fail validation with authentication error", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			const authError = new Error("Unauthorized") as any
			authError.status = 401
			mockEmbeddingsCreate.mockRejectedValue(authError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("Authentication failed")
		})

		it("should fail validation with connection error", async () => {
			const embedder = new LiteLLMEmbedder("http://localhost:4000", "baai/bge-m3")
			const connectionError = new Error("ECONNREFUSED")
			mockEmbeddingsCreate.mockRejectedValue(connectionError)

			const result = await embedder.validateConfiguration()

			expect(result.valid).toBe(false)
			expect(result.error).toBe("Connection failed")
		})
	})
})
