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

	it("should use native tools for haiku models based on model name", async () => {
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

	it("should use XML protocol for non-haiku models (anthropic without haiku in name)", async () => {
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

		// Call createMessage with tools
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools were NOT included in the request (non-haiku models use XML)
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.not.objectContaining({
				tools: expect.anything(),
			}),
		)
	})

	it("should include tools with tool_choice none when model is haiku", async () => {
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
			tool_choice: "none",
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools ARE included for haiku models and tool_choice is passed through
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

	describe("supportsNativeToolsByModelName - only haiku models support native tools", () => {
		it("should support native tools for models containing 'haiku'", async () => {
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

		it("should NOT support native tools for models containing 'qwen'", async () => {
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
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because qwen doesn't match 'haiku' pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should NOT support native tools for models containing 'glm'", async () => {
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
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because glm doesn't match 'haiku' pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should NOT support native tools for models containing 'gpt'", async () => {
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
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because gpt doesn't match 'haiku' pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should NOT support native tools for deepseek models", async () => {
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
				toolProtocol: "native",
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because deepseek doesn't match 'haiku' pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should NOT support native tools for llama models", async () => {
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
				toolProtocol: "native",
			})

			for await (const _ of generator) {
				// consume
			}

			// Should NOT include tools because llama doesn't match 'haiku' pattern
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					tools: expect.anything(),
				}),
			)
		})

		it("should be case-insensitive when matching 'haiku' in model names", async () => {
			const upperCaseModels = {
				"anthropic/CLAUDE-HAIKU-4.5": {
					maxTokens: 8192,
					contextWindow: 200000,
					supportsImages: true,
					supportsPromptCache: true,
					inputPrice: 1,
					outputPrice: 5,
				},
			}

			const options: ApiHandlerOptions = {
				modelharborApiKey: "test-key",
				modelharborModelId: "anthropic/CLAUDE-HAIKU-4.5",
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
			})

			for await (const _ of generator) {
				// consume
			}

			// Should include tools because HAIKU matches (case-insensitive)
			expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					tools: expect.any(Array),
				}),
			)
		})
	})
})
