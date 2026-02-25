import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getModelHarborModels } from "../modelharbor"

describe("ModelHarbor Tool Protocol Selection", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should set supportsNativeTools and defaultToolProtocol based on supports_function_calling field (LiteLLM approach)", async () => {
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
						max_input_tokens: 128000,
						max_output_tokens: 16384,
						supports_function_calling: true,
						supports_prompt_caching: true,
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
						supports_function_calling: true,
						supports_prompt_caching: true,
					},
				},
			],
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		// Models with supports_function_calling=true should use native tools (LiteLLM approach)
		expect(models["anthropic/claude-sonnet-4-code"]).toBeDefined()
		expect(models["anthropic/claude-sonnet-4-code"].supportsNativeTools).toBe(true)
		expect(models["anthropic/claude-sonnet-4-code"].defaultToolProtocol).toBe("native")

		expect(models["anthropic/claude-haiku-4.5-code"]).toBeDefined()
		expect(models["anthropic/claude-haiku-4.5-code"].supportsNativeTools).toBe(true)
		expect(models["anthropic/claude-haiku-4.5-code"].defaultToolProtocol).toBe("native")
	})

	it("should set defaultToolProtocol to native for non-code haiku-4.5 models", async () => {
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
						supports_function_calling: true,
						supports_prompt_caching: true,
					},
				},
			],
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		expect(models["anthropic/claude-haiku-4.5"]).toBeDefined()
		expect(models["anthropic/claude-haiku-4.5"].supportsNativeTools).toBe(true)
		expect(models["anthropic/claude-haiku-4.5"].defaultToolProtocol).toBe("native")
	})

	it("should set defaultToolProtocol to native for non-code sonnet-4 models", async () => {
		const mockResponse = {
			data: [
				{
					model_name: "anthropic/claude-sonnet-4",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "anthropic/claude-sonnet-4",
					},
					model_info: {
						input_cost_per_token: 0.000003,
						output_cost_per_token: 0.000015,
						max_input_tokens: 128000,
						max_output_tokens: 16384,
						supports_function_calling: true,
						supports_prompt_caching: true,
					},
				},
			],
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		expect(models["anthropic/claude-sonnet-4"]).toBeDefined()
		expect(models["anthropic/claude-sonnet-4"].supportsNativeTools).toBe(true)
		expect(models["anthropic/claude-sonnet-4"].defaultToolProtocol).toBe("native")
	})

	it("should handle multiple models with different tool protocols", async () => {
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
						max_output_tokens: 64000,
						supports_function_calling: true,
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
						max_output_tokens: 64000,
						supports_function_calling: true,
					},
				},
				{
					model_name: "openai/gpt-4.1",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "openai/gpt-4.1",
					},
					model_info: {
						input_cost_per_token: 0.0000015,
						output_cost_per_token: 0.0000075,
						max_input_tokens: 128000,
						max_output_tokens: 16384,
						supports_function_calling: true,
					},
				},
			],
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		// Haiku 4.5 (non-code) should use native protocol
		expect(models["anthropic/claude-haiku-4.5"].defaultToolProtocol).toBe("native")
		expect(models["anthropic/claude-haiku-4.5"].supportsNativeTools).toBe(true)

		// Haiku 4.5-code should also use native protocol (LiteLLM approach: uses supports_function_calling)
		expect(models["anthropic/claude-haiku-4.5-code"].defaultToolProtocol).toBe("native")
		expect(models["anthropic/claude-haiku-4.5-code"].supportsNativeTools).toBe(true)

		// Other models with supports_function_calling=true should also use native protocol
		expect(models["openai/gpt-4.1"].defaultToolProtocol).toBe("native")
		expect(models["openai/gpt-4.1"].supportsNativeTools).toBe(true)
	})

	it("should set supportsNativeTools and defaultToolProtocol based on supports_function_calling field", async () => {
		const mockResponse = {
			data: [
				{
					model_name: "test/model-with-tools",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "test/model-with-tools",
					},
					model_info: {
						input_cost_per_token: 0.000001,
						output_cost_per_token: 0.000005,
						max_input_tokens: 100000,
						max_output_tokens: 4096,
						supports_function_calling: true,
					},
				},
				{
					model_name: "test/model-without-tools",
					litellm_params: {
						merge_reasoning_content_in_choices: false,
						model: "test/model-without-tools",
					},
					model_info: {
						input_cost_per_token: 0.000001,
						output_cost_per_token: 0.000005,
						max_input_tokens: 100000,
						max_output_tokens: 4096,
						supports_function_calling: false,
					},
				},
			],
		}

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => mockResponse,
		} as Response)

		const models = await getModelHarborModels()

		// Model with function calling support should use native tools and protocol
		expect(models["test/model-with-tools"].supportsNativeTools).toBe(true)
		expect(models["test/model-with-tools"].defaultToolProtocol).toBe("native")

		// Model without function calling support should use xml protocol
		expect(models["test/model-without-tools"].supportsNativeTools).toBe(false)
		expect(models["test/model-without-tools"].defaultToolProtocol).toBe("xml")
	})
})
