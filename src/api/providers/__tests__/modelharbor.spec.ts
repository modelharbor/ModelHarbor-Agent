import { describe, it, expect, vi, beforeEach } from "vitest"
import { ModelHarborHandler } from "../modelharbor"
import type { ApiHandlerOptions } from "../../../shared/api"

// vscode is mocked globally via vitest.config.ts -> src/__mocks__/vscode.js

// Mock OpenAI
vi.mock("openai", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: vi.fn(),
				},
			},
		})),
	}
})

// Mock types
vi.mock("@roo-code/types", () => ({
	modelHarborModels: { "test-model": { maxTokens: 4096, supportsPromptCache: true } },
	modelHarborDefaultModelId: "test-model",
	getModelHarborModels: vi.fn().mockResolvedValue({ "test-model": { maxTokens: 4096, supportsPromptCache: true } }),
	setModelHarborOutputChannel: vi.fn(),
}))

describe("ModelHarborHandler", () => {
	let handler: ModelHarborHandler
	const mockOptions: ApiHandlerOptions = {
		modelharborApiKey: "test-api-key",
		apiModelId: "test-model",
	}

	beforeEach(() => {
		handler = new ModelHarborHandler(mockOptions)
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with correct options", () => {
			expect(handler).toBeDefined()
			expect(handler["options"]).toMatchObject(mockOptions)
		})

		it("should initialize with ModelHarbor base URL", () => {
			expect(handler["client"]).toBeDefined()
		})
	})

	describe("getModel", () => {
		it("should return the correct model", () => {
			const model = handler.getModel()
			expect(model.id).toBe("test-model")
			expect(model.info).toBeDefined()
		})

		it("should use default model when specified model not available", () => {
			const handlerWithInvalidModel = new ModelHarborHandler({
				...mockOptions,
				apiModelId: "invalid-model",
			})
			const model = handlerWithInvalidModel.getModel()
			expect(model.id).toBe("test-model") // Should fall back to default
		})
	})

	describe("refreshModels", () => {
		it("should refresh models cache", async () => {
			await handler.refreshModels()
			expect(handler["modelsCache"]).toBeDefined()
		})

		it("should handle refresh errors gracefully", async () => {
			const { getModelHarborModels } = await import("@roo-code/types")
			vi.mocked(getModelHarborModels).mockRejectedValueOnce(new Error("Network error"))

			await expect(handler.refreshModels()).resolves.not.toThrow()
		})
	})

	describe("createMessage", () => {
		it("should create streaming iterator", async () => {
			const mockStream = {
				[Symbol.asyncIterator]: async function* () {
					yield {
						choices: [{ delta: { content: "Hello" } }],
						usage: null,
					}
					yield {
						choices: [{ delta: { content: " world" } }],
						usage: { prompt_tokens: 10, completion_tokens: 5 },
					}
				},
			}

			handler["client"].chat.completions.create = vi.fn().mockResolvedValue(mockStream)

			const iterator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }])

			const chunks = []
			for await (const chunk of iterator) {
				chunks.push(chunk)
			}

			expect(chunks).toHaveLength(3) // 2 text chunks + 1 usage chunk
			expect(chunks[0]).toEqual({ type: "text", text: "Hello" })
			expect(chunks[1]).toEqual({ type: "text", text: " world" })
			expect(chunks[2]).toEqual({
				type: "usage",
				inputTokens: 10,
				outputTokens: 5,
				cacheReadTokens: undefined,
			})
		})
	})
})
