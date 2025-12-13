import {
	modelHarborModels,
	modelHarborDefaultModelId,
	getModelHarborModels,
	setModelHarborOutputChannel,
	type ModelHarborModelId,
	TOOL_PROTOCOL,
} from "@roo-code/types"
import * as vscode from "vscode"
import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { calculateApiCostOpenAI } from "../../shared/cost"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { MODELHARBOR_HEADERS } from "./constants"
import { unescapeHtmlEntities } from "../../utils/text-normalization"

// Create ModelHarbor-specific output channel
let modelHarborOutputChannel: vscode.OutputChannel | null = null

export class ModelHarborHandler
	extends BaseOpenAiCompatibleProvider<ModelHarborModelId>
	implements SingleCompletionHandler
{
	private modelsCache: Record<string, any> | null = null

	constructor(options: ApiHandlerOptions) {
		super({
			...options,
			providerName: "ModelHarbor",
			baseURL: "https://api.modelharbor.com/v1",
			apiKey: options.modelharborApiKey,
			defaultProviderModelId: modelHarborDefaultModelId,
			providerModels: modelHarborModels,
			defaultTemperature: 0.7,
		})

		// Override the client with ModelHarbor-specific headers
		this.client = new OpenAI({
			baseURL: "https://api.modelharbor.com/v1",
			apiKey: options.modelharborApiKey,
			defaultHeaders: MODELHARBOR_HEADERS,
		})

		// Set up output channel for logging if not already done
		if (!modelHarborOutputChannel) {
			modelHarborOutputChannel = vscode.window.createOutputChannel("ModelHarbor")
			setModelHarborOutputChannel(modelHarborOutputChannel)
		}

		// Initialize models cache
		this.initializeModels()
	}

	private isGpt5(modelId: string): boolean {
		// Match gpt-5, gpt5, and variants like gpt-5o, gpt-5-turbo, gpt5-preview, gpt-5.1
		// Avoid matching gpt-50, gpt-500, etc.
		return /\bgpt-?5(?!\d)/i.test(modelId)
	}

	private async initializeModels() {
		try {
			if (modelHarborOutputChannel) {
				modelHarborOutputChannel.appendLine("🚀 Initializing ModelHarbor models from extension host...")
			}
			this.modelsCache = await getModelHarborModels()
			if (modelHarborOutputChannel && this.modelsCache) {
				const modelCount = Object.keys(this.modelsCache).length
				modelHarborOutputChannel.appendLine(`✅ Successfully initialized ${modelCount} ModelHarbor models`)
			}
		} catch (error) {
			const errorMsg = `Failed to initialize ModelHarbor models: ${error}`
			console.error(errorMsg)
			if (modelHarborOutputChannel) {
				modelHarborOutputChannel.appendLine(`❌ ${errorMsg}`)
			}
		}
	}

	override getModel() {
		// Use cached models if available, otherwise fall back to proxy
		const availableModels = this.modelsCache || this.providerModels

		const id =
			this.options.modelharborModelId && this.options.modelharborModelId in availableModels
				? (this.options.modelharborModelId as ModelHarborModelId)
				: this.defaultProviderModelId

		return { id, info: availableModels[id] }
	}

	// Method to refresh models if needed
	async refreshModels() {
		try {
			this.modelsCache = await getModelHarborModels()
		} catch (error) {
			console.error("Failed to refresh ModelHarbor models:", error)
		}
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}

	// Add prompt caching support for models that support it
	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const { id: modelId, info } = this.getModel()
		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		const openAiMessages = convertToOpenAiMessages(messages)

		// Prepare messages with cache control if enabled and supported
		let systemMessage: OpenAI.Chat.ChatCompletionMessageParam
		let enhancedMessages: OpenAI.Chat.ChatCompletionMessageParam[]

		// Check if prompt caching should be used:
		// 1. User must have enabled it via modelharborUsePromptCache setting
		// 2. Model must support prompt caching
		// 3. Model name must not contain "-code" (disable caching for code models)
		const shouldUsePromptCache =
			this.options.modelharborUsePromptCache && info.supportsPromptCache && !modelId.includes("-code")

		if (shouldUsePromptCache) {
			// Create system message with cache control in the proper format
			systemMessage = {
				role: "system",
				content: [
					{
						type: "text",
						text: systemPrompt,
						cache_control: { type: "ephemeral" },
					} as any,
				],
			}

			// Find the last two user messages to apply caching
			const userMsgIndices = openAiMessages.reduce(
				(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
				[] as number[],
			)
			const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
			const secondLastUserMsgIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

			// Apply cache_control to the last two user messages
			enhancedMessages = openAiMessages.map((message, index) => {
				if ((index === lastUserMsgIndex || index === secondLastUserMsgIndex) && message.role === "user") {
					// Handle both string and array content types
					if (typeof message.content === "string") {
						return {
							...message,
							content: [
								{
									type: "text",
									text: message.content,
									cache_control: { type: "ephemeral" },
								} as any,
							],
						}
					} else if (Array.isArray(message.content)) {
						// Apply cache control to the last content item in the array
						return {
							...message,
							content: message.content.map((content, contentIndex) =>
								contentIndex === message.content.length - 1
									? ({
											...content,
											cache_control: { type: "ephemeral" },
										} as any)
									: content,
							),
						}
					}
				}
				return message
			})
		} else {
			// No cache control - use simple format
			systemMessage = { role: "system", content: systemPrompt }
			enhancedMessages = openAiMessages
		}

		// Required by some providers; others default to max tokens allowed
		let maxTokens: number | undefined = info.maxTokens ?? undefined

		// Check if this is a GPT-5 model that requires max_completion_tokens instead of max_tokens
		const isGPT5Model = this.isGpt5(modelId)

		// Check if model supports native tools and tools are provided with native protocol
		// Similar to Bedrock: use native tools when supported and toolProtocol is not explicitly "xml"
		const supportsNativeTools = info.supportsNativeTools ?? false
		const useNativeTools =
			supportsNativeTools &&
			metadata?.tools &&
			metadata.tools.length > 0 &&
			metadata?.toolProtocol !== "xml" &&
			metadata?.tool_choice !== "none"

		const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			messages: [systemMessage, ...enhancedMessages],
			stream: true,
			stream_options: {
				include_usage: true,
			},
			...(useNativeTools && { tools: this.convertToolsForOpenAI(metadata.tools) }),
			...(useNativeTools && metadata.tool_choice && { tool_choice: metadata.tool_choice }),
			...(useNativeTools && { parallel_tool_calls: metadata?.parallelToolCalls ?? false }),
		}

		// GPT-5 models require max_completion_tokens instead of the deprecated max_tokens parameter
		if (isGPT5Model && maxTokens) {
			requestOptions.max_completion_tokens = maxTokens
		} else if (maxTokens) {
			requestOptions.max_tokens = maxTokens
		}

		if (this.supportsTemperature(modelId)) {
			requestOptions.temperature = temperature
		}

		try {
			const stream = await this.client.chat.completions.create(requestOptions)

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				const usage = chunk.usage as ModelHarborUsage

				if (delta?.content) {
					yield { type: "text", text: delta.content }
				}

				// Handle tool calls in stream - emit partial chunks for NativeToolCallParser
				if (delta?.tool_calls) {
					for (const toolCall of delta.tool_calls) {
						yield {
							type: "tool_call_partial",
							index: toolCall.index,
							id: toolCall.id,
							name: toolCall.function?.name,
							arguments: toolCall.function?.arguments,
						}
					}
				}

				if (usage) {
					// Extract cache-related information if available
					// ModelHarbor may use different field names for cache tokens
					const cacheWriteTokens =
						usage.cache_creation_input_tokens || (usage as any).prompt_cache_miss_tokens || 0
					const cacheReadTokens =
						usage.prompt_tokens_details?.cached_tokens ||
						(usage as any).cache_read_input_tokens ||
						(usage as any).prompt_cache_hit_tokens ||
						0

					const usageData: ApiStreamUsageChunk = {
						type: "usage",
						inputTokens: usage.prompt_tokens || 0,
						outputTokens: usage.completion_tokens || 0,
					}

					// Only include cache tokens if they exist
					if (cacheWriteTokens > 0) {
						usageData.cacheWriteTokens = cacheWriteTokens
					}
					if (cacheReadTokens > 0) {
						usageData.cacheReadTokens = cacheReadTokens
					}

					// Calculate cost
					const costResult = calculateApiCostOpenAI(
						info,
						usageData.inputTokens,
						usageData.outputTokens,
						cacheWriteTokens,
						cacheReadTokens,
					)

					// Only include totalCost if it's greater than 0
					if (costResult.totalCost > 0) {
						usageData.totalCost = costResult.totalCost
					}

					yield usageData
				}
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`ModelHarbor streaming error: ${error.message}`)
			}
			throw error
		}
	}

	override async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info } = this.getModel()

		// Check if this is a GPT-5 model that requires max_completion_tokens instead of max_tokens
		const isGPT5Model = this.isGpt5(modelId)

		try {
			const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
				model: modelId,
				messages: [{ role: "user", content: prompt }],
			}

			if (this.supportsTemperature(modelId)) {
				requestOptions.temperature = this.options.modelTemperature ?? this.defaultTemperature
			}

			// GPT-5 models require max_completion_tokens instead of the deprecated max_tokens parameter
			if (isGPT5Model && info.maxTokens) {
				requestOptions.max_completion_tokens = info.maxTokens
			} else if (info.maxTokens) {
				requestOptions.max_tokens = info.maxTokens
			}

			const response = await this.client.chat.completions.create(requestOptions)
			const content = response.choices[0]?.message.content || ""

			// DEBUG: Log response content to diagnose encoding issues
			if (modelHarborOutputChannel && content) {
				modelHarborOutputChannel.appendLine(`🔍 DEBUG: Non-streaming response content: "${content}"`)
				modelHarborOutputChannel.appendLine(`🔍 DEBUG: Content length: ${content.length}`)
				modelHarborOutputChannel.appendLine(`🔍 DEBUG: Contains HTML entities: ${/[&<>"']/.test(content)}`)

				// Check for common HTML entities
				const htmlEntities = [
					"&lt;",
					"&gt;",
					"&amp;",
					"&quot;",
					"&#39;",
					"&apos;",
					"&#91;",
					"&#93;",
					"&lsqb;",
					"&rsqb;",
				]
				const foundEntities = htmlEntities.filter((entity) => content.includes(entity))
				if (foundEntities.length > 0) {
					modelHarborOutputChannel.appendLine(
						`🔍 DEBUG: Found HTML entities in non-streaming: ${foundEntities.join(", ")}`,
					)
				}
			}

			// FIX: Apply HTML entity unescaping for ModelHarbor (non-Claude model)
			// This matches the behavior in individual tools like writeToFileTool and executeCommandTool
			const unescapedContent = unescapeHtmlEntities(content)

			// DEBUG: Log unescaped content for comparison
			if (modelHarborOutputChannel && unescapedContent !== content) {
				modelHarborOutputChannel.appendLine(`🔧 DEBUG: Non-streaming unescaped content: "${unescapedContent}"`)
				modelHarborOutputChannel.appendLine(`🔧 DEBUG: Non-streaming content was modified by unescaping`)
			}

			return unescapedContent
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`ModelHarbor completion error: ${error.message}`)
			}
			throw error
		}
	}
}

// ModelHarbor usage may include an extra field for Anthropic use cases.
interface ModelHarborUsage extends OpenAI.CompletionUsage {
	cache_creation_input_tokens?: number
}
