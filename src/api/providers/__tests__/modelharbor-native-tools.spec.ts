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

	it("should use native tools for haiku-4.5 when toolProtocol is not explicitly set", async () => {
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

		// Call createMessage with tools but without explicit toolProtocol
		// (should default to native for haiku-4.5)
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			// toolProtocol is not set, should use model's default (native for haiku-4.5)
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

	it("should NOT use native tools for haiku-4.5 when toolProtocol is explicitly set to xml", async () => {
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

		// Call createMessage with tools and explicit xml protocol
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			toolProtocol: "xml", // Explicitly request XML protocol
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools were NOT included in the request (XML mode uses prompt-based tools)
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.not.objectContaining({
				tools: expect.anything(),
			}),
		)
	})

	it("should use native tools for sonnet-4 when toolProtocol is explicitly set to native", async () => {
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

		// Call createMessage with tools and explicit native protocol
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			toolProtocol: "native", // Explicitly request native protocol
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

	it("should NOT use native tools when tool_choice is none", async () => {
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

		// Call createMessage with tools but tool_choice = none
		const generator = handler.createMessage("System prompt", [{ role: "user", content: "Test message" }], {
			taskId: "test-task-id",
			tools,
			tool_choice: "none", // Explicitly disable tool use
		})

		// Consume the generator
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}

		// Verify that tools were NOT included in the request
		expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
			expect.not.objectContaining({
				tools: expect.anything(),
			}),
		)
	})
})
