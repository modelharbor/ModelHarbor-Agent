import {
	modelHarborModels,
	modelHarborDefaultModelId,
	getModelHarborModels,
	setModelHarborOutputChannel,
	type ModelHarborModelId,
} from "@roo-code/types"
import * as vscode from "vscode"
import OpenAI from "openai"
import { addCacheBreakpoints as addModelHarborCacheBreakpoints } from "../transform/caching/modelharbor"
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
		const { id, info } = this.getModel()
		const temperature = this.options.modelTemperature ?? this.defaultTemperature

		// Convert to OpenAI-compatible messages
		const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// Apply prompt caching if supported
		if (info.supportsPromptCache) {
			addModelHarborCacheBreakpoints(systemPrompt, openAiMessages)
		}

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model: id,
			max_tokens: info.maxTokens,
			temperature,
			messages: openAiMessages,
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
