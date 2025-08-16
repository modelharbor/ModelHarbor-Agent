import { describe, it, expect, vi, beforeEach } from "vitest"
import { ModelHarborHandler } from "../modelharbor"
import type { ApiHandlerOptions } from "../../../shared/api"

// vscode is mocked globally via vitest.config.ts -> src/__mocks__/vscode.js

// Mock the types module
vi.mock("@roo-code/types", async () => {
	const actual = await vi.importActual("@roo-code/types")
	return {
		...actual,
		modelHarborModels: {
			"anthropic/claude-haiku-4.5-code": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				supportsNativeTools: true,
				defaultToolProtocol: "native",
				inputPrice: 1,
				outputPrice: 5,
			},
			"anthropic/claude-sonnet-4-code": {
				maxTokens: 16384,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: true,
				supportsNativeTools: true,
				defaultToolProtocol: "xml",
				inputPrice: 3,
				outputPrice: 15,
			},
		},
		modelHarborDefaultModelId: "anthropic/claude-haiku-4.5-code",
		getModelHarborModels: vi.fn().mockResolvedValue({
			"anthropic/claude-haiku-4.5-code": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				supportsNativeTools: true,
				defaultToolProtocol: "native",
				inputPrice: 1,
				outputPrice: 5,
			},
			"anthropic/claude-sonnet-4-code": {
				maxTokens: 16384,
				contextWindow: 128000,
				supportsImages: true,
				supportsPromptCache: true,
				supportsNativeTools: true,
				defaultToolProtocol: "xml",
				inputPrice: 3,
				outputPrice: 15,
			},
		}),
		setModelHarborOutputChannel: vi.fn(),
		TOOL_PROTOCOL: {
			NATIVE: "native",
			XML: "xml",
		},
	}
})

describe("ModelHarbor Native Tools Support", () => {
	let mockStreamResponse: any
	let mockClient: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Create a mock async iterator for streaming response
		mockStreamResponse = {
			[Symbol.asyncIterator]: async function* () {
				yield {
					choices: [
						{
							delta: {
								content: "test response",
								tool_calls: [
									{
										index: 0,
										id: "call_123",
										function: {
											name: "test_tool",
											arguments: '{"param": "value"}',
										},
									},
								],
							},
						},
					],
					usage: {
						prompt_tokens: 100,
						completion_tokens: 50,
					},
				}
			},
		}

		// Mock the OpenAI client
		mockClient = {
			chat: {
				completions: {
					create: vi.fn().mockResolvedValue(mockStreamResponse),
				},
			},
		}
	})

	it("should use native tools for anthropic models based on model name (ignores toolProtocol)", async () => {
		const options: ApiHandlerOptions = {
			modelharborApiKey: "test-key",
			modelharborModelId: "anthropic/claude-haiku-4.5-code",
		}

		const handler = new ModelHarborHandler(options)
		// Replace the client with our mock
		;(handler as any).client = mockClient

		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: {
						type: "object",
						properties: {
							param: { type: "string" },
						},
					},
				},
			},
		]

		// Call createMessage with tools - no toolProtocol specified
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			// No toolProtocol specified - should still use native tools based on model name
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools were included in the request
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({
						type: "function",
						function: expect.objectContaining({
							name: "test_tool",
						}),
					}),
				]),
			}),
		)
	})

	it("should STILL use native tools for anthropic models even when toolProtocol is set to xml", async () => {
		const options: ApiHandlerOptions = {
			modelharborApiKey: "test-key",
			modelharborModelId: "anthropic/claude-haiku-4.5-code",
		}

		const handler = new ModelHarborHandler(options)
		;(handler as any).client = mockClient

		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: {
						type: "object",
						properties: {
							param: { type: "string" },
						},
					},
				},
			},
		]

		// Call createMessage with tools and explicit xml protocol - should be ignored for anthropic models
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			toolProtocol: "xml", // Explicitly request XML protocol - but should be ignored for anthropic models
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools WERE included in the request (model name determines native tool use, not toolProtocol)
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({
						type: "function",
						function: expect.objectContaining({
							name: "test_tool",
						}),
					}),
				]),
			}),
		)
	})

	it("should use native tools for sonnet-4 based on model name containing 'anthropic'", async () => {
		const options: ApiHandlerOptions = {
			modelharborApiKey: "test-key",
			modelharborModelId: "anthropic/claude-sonnet-4-code",
		}

		const handler = new ModelHarborHandler(options)
		;(handler as any).client = mockClient

		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: {
						type: "object",
						properties: {
							param: { type: "string" },
						},
					},
				},
			},
		]

		// Call createMessage with tools - no toolProtocol needed
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools were included in the request
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({
						type: "function",
						function: expect.objectContaining({
							name: "test_tool",
						}),
					}),
				]),
			}),
		)
	})

	it("should include tools with tool_choice none when model supports native tools", async () => {
		const options: ApiHandlerOptions = {
			modelharborApiKey: "test-key",
			modelharborModelId: "anthropic/claude-haiku-4.5-code",
		}

		const handler = new ModelHarborHandler(options)
		;(handler as any).client = mockClient

		const tools = [
			{
				type: "function" as const,
				function: {
					name: "test_tool",
					description: "A test tool",
					parameters: {
						type: "object",
						properties: {
							param: { type: "string" },
						},
					},
				},
			},
		]

		// Call createMessage with tools and tool_choice = none
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			tool_choice: "none", // Pass tool_choice to API
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools ARE included (model name determines native tool support)
		// and tool_choice is passed through to the API
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				tools: expect.arrayContaining([
					expect.objectContaining({
						type: "function",
						function: expect.objectContaining({
							name: "test_tool",
						}),
					}),
				]),
				tool_choice: "none",
			}),
		)
	})

	describe("supportsNativeToolsByModelName - model name determines native tool support", () => {
		it("should support native tools for models containing 'anthropic' (no toolProtocol needed)", async () => {
			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "anthropic/claude-haiku-4.5-code",
			}

			const handler = new ModelHarborHandler(options)
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// No toolProtocol - model name determines native tool support
			})

			for await (const _ of generator) {
				// consume
			}

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
				}),
			)
		})

		it("should support native tools for models containing 'qwen' (no toolProtocol needed)", async () => {
			// Add qwen model to the mock
			const qwenModels = {
				"qwen/qwen-2.5-coder": {
					maxTokens: 8192,
					contextWindow: 128000,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.5,
					outputPrice: 1,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "qwen/qwen-2.5-coder",
			}

			const handler = new ModelHarborHandler(options)
			// Manually inject the qwen model into cache
			;(handler as any).modelsCache = qwenModels
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// No toolProtocol - model name determines native tool support
			})

			for await (const _ of generator) {
				// consume
			}

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
				}),
			)
		})

		it("should support native tools for models containing 'glm' (no toolProtocol needed)", async () => {
			const glmModels = {
				"zhipu/glm-4": {
					maxTokens: 4096,
					contextWindow: 128000,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.5,
					outputPrice: 1,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "zhipu/glm-4",
			}

			const handler = new ModelHarborHandler(options)
			;(handler as any).modelsCache = glmModels
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// No toolProtocol - model name determines native tool support
			})

			for await (const _ of generator) {
				// consume
			}

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
				}),
			)
		})

		it("should support native tools for models containing 'gpt' (no toolProtocol needed)", async () => {
			const gptModels = {
				"openai/gpt-4o": {
					maxTokens: 4096,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: false,
					inputPrice: 5,
					outputPrice: 15,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "openai/gpt-4o",
			}

			const handler = new ModelHarborHandler(options)
			;(handler as any).modelsCache = gptModels
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// No toolProtocol - model name determines native tool support
			})

			for await (const _ of generator) {
				// consume
			}

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
				}),
			)
		})

		it("should NOT support native tools for models without matching patterns (deepseek)", async () => {
			const otherModels = {
				"deepseek/deepseek-coder": {
					maxTokens: 4096,
					contextWindow: 64000,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.1,
					outputPrice: 0.2,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "deepseek/deepseek-coder",
			}

			const handler = new ModelHarborHandler(options)
			;(handler as any).modelsCache = otherModels
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// Even with toolProtocol: "native", deepseek won't use native tools
				toolProtocol: "native",
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because deepseek doesn't match any pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should NOT support native tools for llama models (even with toolProtocol: native)", async () => {
			const llamaModels = {
				"meta/llama-3.1-70b": {
					maxTokens: 4096,
					contextWindow: 128000,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: 0.5,
					outputPrice: 1,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "meta/llama-3.1-70b",
			}

			const handler = new ModelHarborHandler(options)
			;(handler as any).modelsCache = llamaModels
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// Even with toolProtocol: "native", llama won't use native tools
				toolProtocol: "native",
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because llama doesn't match any pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should be case-insensitive when matching model names (no toolProtocol needed)", async () => {
			const upperCaseModels = {
				"OPENAI/GPT-4O-MINI": {
					maxTokens: 4096,
					contextWindow: 128000,
					supportsImages: true,
					supportsPromptCache: false,
					inputPrice: 0.15,
					outputPrice: 0.6,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "OPENAI/GPT-4O-MINI",
			}

			const handler = new ModelHarborHandler(options)
			;(handler as any).modelsCache = upperCaseModels
			;(handler as any).client = mockClient

			const tools = [
				{
					type: "function" as const,
					function: {
						name: "test_tool",
						description: "A test tool",
						parameters: { type: "object", properties: {} },
					},
				},
			]

			const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test" }], {
				taskId: "test-task-id",
				tools,
				// No toolProtocol - model name determines native tool support
			})

			for await (const _ of generator) {
				// consume
			}

			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
				}),
			)
		})
	})
})
