import axios from "axios"

import { getLiteLLMModels, isNonChatModel } from "../api/providers/fetchers/litellm"

vi.mock("axios")
const mockedAxios = axios as any

describe("LiteLLM model filtering", () => {
	const baseModelInfo = {
		max_output_tokens: 8192,
		max_input_tokens: 128000,
		supports_function_calling: true,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("isNonChatModel", () => {
		it("returns false for dall-e-3 when no filter keyword is present", () => {
			expect(isNonChatModel("dall-e-3")).toBe(false)
		})

		it("returns true when the model name contains image", () => {
			expect(isNonChatModel("openai/dall-e-image-gen")).toBe(true)
		})

		it("returns true when the model name contains embedding", () => {
			expect(isNonChatModel("text-embedding-ada-002")).toBe(true)
		})

		it("returns true when the model name contains rerank", () => {
			expect(isNonChatModel("cohere-rerank-v3")).toBe(true)
		})

		it("returns false for gpt-4o", () => {
			expect(isNonChatModel("gpt-4o")).toBe(false)
		})

		it("returns false for claude-3.5-sonnet", () => {
			expect(isNonChatModel("claude-3.5-sonnet")).toBe(false)
		})

		it("matches keywords case-insensitively", () => {
			expect(isNonChatModel("IMAGE-GEN-MODEL")).toBe(true)
		})

		it("returns true for custom embedding model names", () => {
			expect(isNonChatModel("my-embedding-model")).toBe(true)
		})
	})

	describe("getLiteLLMModels", () => {
		it("filters out image, embedding, and rerank models from the result", async () => {
			mockedAxios.get.mockResolvedValueOnce({
				data: {
					data: [
						{
							model_name: "gpt-4o",
							model_info: baseModelInfo,
							litellm_params: {
								model: "openai/gpt-4o",
							},
						},
						{
							model_name: "claude-3.5-sonnet",
							model_info: baseModelInfo,
							litellm_params: {
								model: "anthropic/claude-3.5-sonnet",
							},
						},
						{
							model_name: "image-router",
							model_info: baseModelInfo,
							litellm_params: {
								model: "openai/gpt-4o",
							},
						},
						{
							model_name: "search-router",
							model_info: baseModelInfo,
							litellm_params: {
								model: "text-embedding-3-large",
							},
						},
						{
							model_name: "ranker-router",
							model_info: baseModelInfo,
							litellm_params: {
								model: "cohere-rerank-v3",
							},
						},
					],
				},
			})

			const models = await getLiteLLMModels("test-key", "https://litellm.example.com/proxy/")

			expect(mockedAxios.get).toHaveBeenCalledWith(
				"https://litellm.example.com/proxy/v1/model/info",
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-key",
						"Content-Type": "application/json",
					}),
					timeout: 5000,
				}),
			)

			expect(Object.keys(models)).toHaveLength(2)
			expect(models["gpt-4o"]).toBeDefined()
			expect(models["claude-3.5-sonnet"]).toBeDefined()
			expect(models["image-router"]).toBeUndefined()
			expect(models["search-router"]).toBeUndefined()
			expect(models["ranker-router"]).toBeUndefined()
		})
	})
})
