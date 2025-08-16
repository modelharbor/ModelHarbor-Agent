import { describe, it, expect, vi, beforeEach } from "vitest"
import { ModelHarborHandler } from "../modelharbor"
import { modelHarborDefaultModelId } from "@roo-code/types"

// Mock the vscode module
vi.mock("vscode", () => ({
	window: {
		createOutputChannel: vi.fn(() => ({
			appendLine: vi.fn(),
		})),
	},
}))

// Mock the getModelHarborModels function
vi.mock("@roo-code/types", async () => {
	const actual = await vi.importActual("@roo-code/types")
	return {
		...actual,
		getModelHarborModels: vi.fn().mockResolvedValue({
			"anthropic/claude-sonnet-4-code": {
				maxTokens: 16384,
				contextWindow: 128000,
				supportsImages: true,
				supportsComputerUse: false,
				supportsPromptCache: false,
				inputPrice: 3.0,
				outputPrice: 15.0,
				description: "Anthropic Claude Sonnet 4 with advanced language understanding and generation.",
			},
			"anthropic/claude-3-5-sonnet": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsComputerUse: true,
				supportsPromptCache: true,
				inputPrice: 3.0,
				outputPrice: 15.0,
				description: "Anthropic Claude 3.5 Sonnet with vision and computer use capabilities.",
			},
		}),
		setModelHarborOutputChannel: vi.fn(),
	}
})

describe("ModelHarborHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getModel", () => {
		it("should use modelharborModelId when provided and available", async () => {
			const handler = new ModelHarborHandler({
				modelharborApiKey: "test-key",
				modelharborModelId: "anthropic/claude-3-5-sonnet",
			})

			// Wait for models to initialize
			await new Promise((resolve) => setTimeout(resolve, 100))

			const result = handler.getModel()

			expect(result.id).toBe("anthropic/claude-3-5-sonnet")
			expect(result.info).toEqual({
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsComputerUse: true,
				supportsPromptCache: true,
				inputPrice: 3.0,
				outputPrice: 15.0,
				description: "Anthropic Claude 3.5 Sonnet with vision and computer use capabilities.",
			})
		})

		it("should fall back to default model when modelharborModelId is not available", async () => {
			const handler = new ModelHarborHandler({
				modelharborApiKey: "test-key",
				modelharborModelId: "non-existent-model",
			})

			// Wait for models to initialize
			await new Promise((resolve) => setTimeout(resolve, 100))

			const result = handler.getModel()

			expect(result.id).toBe(modelHarborDefaultModelId)
		})

		it("should fall back to default model when no modelharborModelId is provided", async () => {
			const handler = new ModelHarborHandler({
				modelharborApiKey: "test-key",
			})

			// Wait for models to initialize
			await new Promise((resolve) => setTimeout(resolve, 100))

			const result = handler.getModel()

			expect(result.id).toBe(modelHarborDefaultModelId)
		})

		it("should not use apiModelId for model selection", async () => {
			const handler = new ModelHarborHandler({
				modelharborApiKey: "test-key",
				apiModelId: "anthropic/claude-3-5-sonnet", // This should be ignored
				modelharborModelId: "anthropic/claude-sonnet-4-code",
			})

			// Wait for models to initialize
			await new Promise((resolve) => setTimeout(resolve, 100))

			const result = handler.getModel()

			// Should use modelharborModelId, not apiModelId
			expect(result.id).toBe("anthropic/claude-sonnet-4-code")
			expect(result.id).not.toBe("anthropic/claude-3-5-sonnet")
		})
	})
})
