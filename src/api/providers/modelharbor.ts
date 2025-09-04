import {
	modelHarborModels,
	modelHarborDefaultModelId,
	getModelHarborModels,
	setModelHarborOutputChannel,
	type ModelHarborModelId,
} from "@roo-code/types"
import * as vscode from "vscode"
import OpenAI from "openai"
import type { Anthropic } from "@anthropic-ai/sdk"
import type { ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { ApiHandlerOptions } from "../../shared/api"

import { BaseOpenAiCompatibleProvider } from "./base-openai-compatible-provider"
import { MODELHARBOR_HEADERS } from "./constants"

// Create ModelHarbor-specific output channel
let modelHarborOutputChannel: vscode.OutputChannel | null = null

export class ModelHarborHandler extends BaseOpenAiCompatibleProvider<ModelHarborModelId> {
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
		// 1. Model must support prompt caching
		// 2. Model name must not contain "-code" (disable caching for code models)
		const shouldUsePromptCache = info.supportsPromptCache && !modelId.includes("-code")

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

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: modelId,
			max_tokens: maxTokens,
			messages: [systemMessage, ...enhancedMessages],
			stream: true,
			stream_options: { include_usage: true },
		}

		const stream = await this.client.chat.completions.create(params)

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta

			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}

			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
					cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens,
				}
			}
		}
	}
}
