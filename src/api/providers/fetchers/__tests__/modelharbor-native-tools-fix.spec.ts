import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getModelHarborModels } from "../modelharbor"

describe("ModelHarbor Native Tools Fix - haiku-4.5 Support", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		global.fetch = vi.fn()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should set supportsNativeTools=true and defaultToolProtocol='native' for haiku-4.5 models even when API returns supports_function_calling=false", async () => {
		// Mock API response with haiku-4.5 model that has supports_function_calling=false
		const mockResponse = {
			data: [
				{
					model_name: "anthropic/claude-haiku-4.5-code",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "anthropic/claude-haiku-4.5-code",
					},
					model_info: {
						input_cost_per_token: 0.000001,
						output_cost_per_token: 0.000005,
						max_input_tokens: 200000,
						max_output_tokens: 8192,
						supports_vision: true,
						supports_function_calling: false, // API says no, but we should override
						supports_prompt_caching: true,
					},
				},
			],
		}

		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		const haikuModel = models["anthropic/claude-haiku-4.5-code"]
		expect(haikuModel).toBeDefined()
		expect(haikuModel.supportsNativeTools).toBe(true)
		expect(haikuModel.defaultToolProtocol).toBe("native")
	})

	it("should set supportsNativeTools=true and defaultToolProtocol='native' for sonnet-4 models", async () => {
		// Mock API response with sonnet-4 model
		const mockResponse = {
			data: [
				{
					model_name: "anthropic/claude-sonnet-4-code",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "anthropic/claude-sonnet-4-code",
					},
					model_info: {
						input_cost_per_token: 0.000003,
						output_cost_per_token: 0.000015,
						max_input_tokens: 200000,
						max_output_tokens: 8192,
						supports_vision: true,
						supports_function_calling: false, // API says no, but we should override
						supports_prompt_caching: true,
					},
				},
			],
		}

		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		const sonnetModel = models["anthropic/claude-sonnet-4-code"]
		expect(sonnetModel).toBeDefined()
		expect(sonnetModel.supportsNativeTools).toBe(true)
		expect(sonnetModel.defaultToolProtocol).toBe("native")
	})

	it("should respect API's supports_function_calling=true for other models", async () => {
		// Mock API response with a model that has supports_function_calling=true
		const mockResponse = {
			data: [
				{
					model_name: "openai/gpt-4o",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "openai/gpt-4o",
					},
					model_info: {
						input_cost_per_token: 0.000005,
						output_cost_per_token: 0.000015,
						max_input_tokens: 128000,
						max_output_tokens: 16384,
						supports_vision: true,
						supports_function_calling: true, // API says yes
						supports_prompt_caching: false,
					},
				},
			],
		}

		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		const gptModel = models["openai/gpt-4o"]
		expect(gptModel).toBeDefined()
		expect(gptModel.supportsNativeTools).toBe(true)
		expect(gptModel.defaultToolProtocol).toBe("native")
	})

	it("should set supportsNativeTools=false and defaultToolProtocol='xml' for models without function calling support", async () => {
		// Mock API response with a model that doesn't support function calling
		const mockResponse = {
			data: [
				{
					model_name: "some/legacy-model",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "some/legacy-model",
					},
					model_info: {
						input_cost_per_token: 0.000001,
						output_cost_per_token: 0.000003,
						max_input_tokens: 8192,
						max_output_tokens: 4096,
						supports_vision: false,
						supports_function_calling: false,
						supports_prompt_caching: false,
					},
				},
			],
		}

		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		const legacyModel = models["some/legacy-model"]
		expect(legacyModel).toBeDefined()
		expect(legacyModel.supportsNativeTools).toBe(false)
		expect(legacyModel.defaultToolProtocol).toBe("xml")
	})

	it("should handle multiple haiku-4.5 variants correctly", async () => {
		// Mock API response with multiple haiku-4.5 variants
		const mockResponse = {
			data: [
				{
					model_name: "anthropic/claude-haiku-4.5",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "anthropic/claude-haiku-4.5",
					},
					model_info: {
						input_cost_per_token: 0.000001,
						output_cost_per_token: 0.000005,
						max_input_tokens: 200000,
						max_output_tokens: 8192,
						supports_function_calling: false,
					},
				},
				{
					model_name: "anthropic/claude-haiku-4.5-code",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "anthropic/claude-haiku-4.5-code",
					},
					model_info: {
						input_cost_per_token: 0.000001,
						output_cost_per_token: 0.000005,
						max_input_tokens: 200000,
						max_output_tokens: 8192,
						supports_function_calling: false,
					},
				},
			],
		}

		vi.mocked(global.fetch).mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		// Both variants should support native tools
		expect(models["anthropic/claude-haiku-4.5"].supportsNativeTools).toBe(true)
		expect(models["anthropic/claude-haiku-4.5"].defaultToolProtocol).toBe("native")
		expect(models["anthropic/claude-haiku-4.5-code"].supportsNativeTools).toBe(true)
		expect(models["anthropic/claude-haiku-4.5-code"].defaultToolProtocol).toBe("native")
	})
})
