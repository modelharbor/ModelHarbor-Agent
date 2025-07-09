import { ApiHandlerOptions } from "../../shared/api"
import { ContextProxy } from "../../core/config/ContextProxy"
import { EmbedderProvider } from "./interfaces/manager"
import { CodeIndexConfig, PreviousConfigSnapshot } from "./interfaces/config"
import { DEFAULT_SEARCH_MIN_SCORE, DEFAULT_MAX_SEARCH_RESULTS } from "./constants"
import { getDefaultModelId, getModelDimension, getModelScoreThreshold } from "../../shared/embeddingModels"

/**
 * Manages configuration state and validation for the code indexing feature.
 * Handles loading, validating, and providing access to configuration values.
 */
export class CodeIndexConfigManager {
	private codebaseIndexEnabled: boolean = true
	private embedderProvider: EmbedderProvider = "openai"
	private modelId?: string
	private modelDimension?: number
	private openAiOptions?: ApiHandlerOptions
	private ollamaOptions?: ApiHandlerOptions
	private openAiCompatibleOptions?: { baseUrl: string; apiKey: string; modelDimension?: number }
	private geminiOptions?: { apiKey: string }
	private modelHarborOptions?: { apiKey: string }
	private qdrantUrl?: string = "http://localhost:6333"
	private qdrantApiKey?: string
	private searchMinScore?: number
	private searchMaxResults?: number

	constructor(private readonly contextProxy: ContextProxy) {
		// Initialize with current configuration to avoid false restart triggers
		this._loadAndSetConfiguration()
	}

	/**
	 * Gets the context proxy instance
	 */
	public getContextProxy(): ContextProxy {
		return this.contextProxy
	}

	/**
	 * Private method that handles loading configuration from storage and updating instance variables.
	 * This eliminates code duplication between initializeWithCurrentConfig() and loadConfiguration().
	 */
	private _loadAndSetConfiguration(): void {
		// Load configuration from storage
		const codebaseIndexConfig = this.contextProxy?.getGlobalState("codebaseIndexConfig") ?? {
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
			codebaseIndexSearchMinScore: undefined,
			codebaseIndexSearchMaxResults: undefined,
		}

		const {
			codebaseIndexEnabled,
			codebaseIndexQdrantUrl,
			codebaseIndexEmbedderProvider,
			codebaseIndexEmbedderBaseUrl,
			codebaseIndexEmbedderModelId,
			codebaseIndexSearchMinScore,
			codebaseIndexSearchMaxResults,
		} = codebaseIndexConfig

		const openAiKey = this.contextProxy?.getSecret("codeIndexOpenAiKey") ?? ""
		const qdrantApiKey = this.contextProxy?.getSecret("codeIndexQdrantApiKey") ?? ""
		const openAiCompatibleBaseUrl = codebaseIndexConfig.codebaseIndexOpenAiCompatibleBaseUrl ?? ""
		const openAiCompatibleApiKey = this.contextProxy?.getSecret("codebaseIndexOpenAiCompatibleApiKey") ?? ""
		const geminiApiKey = this.contextProxy?.getSecret("codebaseIndexGeminiApiKey") ?? ""
		const openAiCompatibleModelDimension = this.contextProxy?.getGlobalState(
			"codebaseIndexOpenAiCompatibleModelDimension",
		) as number | undefined
		const modelHarborApiKey = this.contextProxy?.getSecret("codeIndexModelHarborApiKey") ?? ""

		// Update instance variables with configuration
		this.codebaseIndexEnabled = codebaseIndexEnabled ?? true
		this.qdrantUrl = codebaseIndexQdrantUrl
		this.qdrantApiKey = qdrantApiKey ?? ""
		this.searchMinScore = codebaseIndexSearchMinScore
		this.searchMaxResults = codebaseIndexSearchMaxResults

		// Validate and set model dimension
		const rawDimension = codebaseIndexConfig.codebaseIndexEmbedderModelDimension
		if (rawDimension !== undefined && rawDimension !== null) {
			const dimension = Number(rawDimension)
			if (!isNaN(dimension) && dimension > 0) {
				this.modelDimension = dimension
			} else {
				console.warn(
					`Invalid codebaseIndexEmbedderModelDimension value: ${rawDimension}. Must be a positive number.`,
				)
				this.modelDimension = undefined
			}
		} else {
			this.modelDimension = undefined
		}

		this.openAiOptions = { openAiNativeApiKey: openAiKey }

		// Set embedder provider
		if (codebaseIndexEmbedderProvider === "ollama") {
			this.embedderProvider = "ollama"
		} else if (codebaseIndexEmbedderProvider === "openai-compatible") {
			this.embedderProvider = "openai-compatible"
		} else if (codebaseIndexEmbedderProvider === "gemini") {
			this.embedderProvider = "gemini"
		} else if (codebaseIndexEmbedderProvider === "modelharbor") {
			this.embedderProvider = "modelharbor"
		} else {
			this.embedderProvider = "openai"
		}

		this.modelId = codebaseIndexEmbedderModelId || undefined

		this.ollamaOptions = {
			ollamaBaseUrl: codebaseIndexEmbedderBaseUrl,
		}

		this.openAiCompatibleOptions =
			openAiCompatibleBaseUrl && openAiCompatibleApiKey
				? {
						baseUrl: openAiCompatibleBaseUrl,
						apiKey: openAiCompatibleApiKey,
					}
				: undefined

		this.geminiOptions = geminiApiKey ? { apiKey: geminiApiKey } : undefined
		this.modelHarborOptions = modelHarborApiKey ? { apiKey: modelHarborApiKey } : undefined
	}

	/**
	 * Loads persisted configuration from globalState.
	 */
	public async loadConfiguration(): Promise<{
		configSnapshot: PreviousConfigSnapshot
		currentConfig: {
			isConfigured: boolean
			embedderProvider: EmbedderProvider
			modelId?: string
			modelDimension?: number
			openAiOptions?: ApiHandlerOptions
			ollamaOptions?: ApiHandlerOptions
			openAiCompatibleOptions?: { baseUrl: string; apiKey: string }
			geminiOptions?: { apiKey: string }
			modelHarborOptions?: { apiKey: string }
			qdrantUrl?: string
			qdrantApiKey?: string
			searchMinScore?: number
		}
		requiresRestart: boolean
	}> {
		// Capture the ACTUAL previous state before loading new configuration
		const previousConfigSnapshot: PreviousConfigSnapshot = {
			enabled: this.codebaseIndexEnabled,
			configured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			modelDimension: this.modelDimension,
			openAiKey: this.openAiOptions?.openAiNativeApiKey ?? "",
			ollamaBaseUrl: this.ollamaOptions?.ollamaBaseUrl ?? "",
			openAiCompatibleBaseUrl: this.openAiCompatibleOptions?.baseUrl ?? "",
			openAiCompatibleApiKey: this.openAiCompatibleOptions?.apiKey ?? "",
			geminiApiKey: this.geminiOptions?.apiKey ?? "",
			openAiCompatibleModelDimension: this.openAiCompatibleOptions?.modelDimension,
			modelHarborApiKey: this.modelHarborOptions?.apiKey ?? "",
			qdrantUrl: this.qdrantUrl ?? "",
			qdrantApiKey: this.qdrantApiKey ?? "",
		}

		// Refresh secrets from VSCode storage
		await this.contextProxy.refreshSecrets()

		// Load new configuration from storage and update instance variables
		this._loadAndSetConfiguration()

		const requiresRestart = this.doesConfigChangeRequireRestart(previousConfigSnapshot)

		return {
			configSnapshot: previousConfigSnapshot,
			currentConfig: {
				isConfigured: this.isConfigured(),
				embedderProvider: this.embedderProvider,
				modelId: this.modelId,
				modelDimension: this.modelDimension,
				openAiOptions: this.openAiOptions,
				ollamaOptions: this.ollamaOptions,
				openAiCompatibleOptions: this.openAiCompatibleOptions,
				geminiOptions: this.geminiOptions,
				modelHarborOptions: this.modelHarborOptions,
				qdrantUrl: this.qdrantUrl,
				qdrantApiKey: this.qdrantApiKey,
				searchMinScore: this.currentSearchMinScore,
			},
			requiresRestart,
		}
	}

	/**
	 * Checks if the service is properly configured based on the embedder type.
	 */
	public isConfigured(): boolean {
		if (this.embedderProvider === "openai") {
			const openAiKey = this.openAiOptions?.openAiNativeApiKey
			const qdrantUrl = this.qdrantUrl
			return !!(openAiKey && qdrantUrl)
		} else if (this.embedderProvider === "ollama") {
			const ollamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl
			const qdrantUrl = this.qdrantUrl
			return !!(ollamaBaseUrl && qdrantUrl)
		} else if (this.embedderProvider === "openai-compatible") {
			const baseUrl = this.openAiCompatibleOptions?.baseUrl
			const apiKey = this.openAiCompatibleOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			return !!(baseUrl && apiKey && qdrantUrl)
		} else if (this.embedderProvider === "gemini") {
			const apiKey = this.geminiOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			return !!(apiKey && qdrantUrl)
		} else if (this.embedderProvider === "modelharbor") {
			const apiKey = this.modelHarborOptions?.apiKey
			const qdrantUrl = this.qdrantUrl
			return !!(apiKey && qdrantUrl)
		}
		return false
	}

	/**
	 * Determines if a configuration change requires restarting the indexing process.
	 */
	doesConfigChangeRequireRestart(prev: PreviousConfigSnapshot): boolean {
		const nowConfigured = this.isConfigured()

		// Handle null/undefined values safely
		const prevEnabled = prev?.enabled ?? false
		const prevConfigured = prev?.configured ?? false
		const prevProvider = prev?.embedderProvider ?? "openai"
		const prevOpenAiKey = prev?.openAiKey ?? ""
		const prevOllamaBaseUrl = prev?.ollamaBaseUrl ?? ""
		const prevOpenAiCompatibleBaseUrl = prev?.openAiCompatibleBaseUrl ?? ""
		const prevOpenAiCompatibleApiKey = prev?.openAiCompatibleApiKey ?? ""
		const prevModelDimension = prev?.modelDimension
		const prevGeminiApiKey = prev?.geminiApiKey ?? ""
		const prevModelHarborApiKey = prev?.modelHarborApiKey ?? ""
		const prevQdrantUrl = prev?.qdrantUrl ?? ""
		const prevQdrantApiKey = prev?.qdrantApiKey ?? ""

		// 1. Transition from disabled/unconfigured to enabled/configured
		if ((!prevEnabled || !prevConfigured) && this.codebaseIndexEnabled && nowConfigured) {
			return true
		}

		// 2. Transition from enabled to disabled
		if (prevEnabled && !this.codebaseIndexEnabled) {
			return true
		}

		// 3. If wasn't ready before and isn't ready now, no restart needed
		if ((!prevEnabled || !prevConfigured) && (!this.codebaseIndexEnabled || !nowConfigured)) {
			return false
		}

		// 4. CRITICAL CHANGES - Always restart for these
		// Only check for critical changes if feature is enabled
		if (!this.codebaseIndexEnabled) {
			return false
		}

		// Provider change
		if (prevProvider !== this.embedderProvider) {
			return true
		}

		// Authentication changes
		const currentOpenAiKey = this.openAiOptions?.openAiNativeApiKey ?? ""
		const currentOllamaBaseUrl = this.ollamaOptions?.ollamaBaseUrl ?? ""
		const currentOpenAiCompatibleBaseUrl = this.openAiCompatibleOptions?.baseUrl ?? ""
		const currentOpenAiCompatibleApiKey = this.openAiCompatibleOptions?.apiKey ?? ""
		const currentModelDimension = this.modelDimension
		const currentGeminiApiKey = this.geminiOptions?.apiKey ?? ""
		const currentModelHarborApiKey = this.modelHarborOptions?.apiKey ?? ""
		const currentQdrantUrl = this.qdrantUrl ?? ""
		const currentQdrantApiKey = this.qdrantApiKey ?? ""

		if (prevOpenAiKey !== currentOpenAiKey) {
			return true
		}

		if (prevOllamaBaseUrl !== currentOllamaBaseUrl) {
			return true
		}

		if (
			prevOpenAiCompatibleBaseUrl !== currentOpenAiCompatibleBaseUrl ||
			prevOpenAiCompatibleApiKey !== currentOpenAiCompatibleApiKey
		) {
			return true
		}

		if (prevGeminiApiKey !== currentGeminiApiKey) {
			return true
		}

		if (prevModelHarborApiKey !== currentModelHarborApiKey) {
			return true
		}

		// Model dimension changes
		if (prevModelDimension !== currentModelDimension) {
			return true
		}

		// Qdrant configuration changes
		if (prevQdrantUrl !== currentQdrantUrl || prevQdrantApiKey !== currentQdrantApiKey) {
			return true
		}

		// Vector dimension changes
		if (this._hasVectorDimensionChanged(prevProvider, prev?.modelId)) {
			return true
		}

		return false
	}

	/**
	 * Checks if model changes result in vector dimension changes that require restart.
	 */
	private _hasVectorDimensionChanged(prevProvider: EmbedderProvider, prevModelId?: string): boolean {
		const currentProvider = this.embedderProvider
		const currentModelId = this.modelId ?? getDefaultModelId(currentProvider)
		const resolvedPrevModelId = prevModelId ?? getDefaultModelId(prevProvider)

		// If model IDs are the same and provider is the same, no dimension change
		if (prevProvider === currentProvider && resolvedPrevModelId === currentModelId) {
			return false
		}

		// Get vector dimensions for both models
		const prevDimension = getModelDimension(prevProvider, resolvedPrevModelId)
		const currentDimension = getModelDimension(currentProvider, currentModelId)

		// If we can't determine dimensions, be safe and restart
		if (prevDimension === undefined || currentDimension === undefined) {
			return true
		}

		// Only restart if dimensions actually changed
		return prevDimension !== currentDimension
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): CodeIndexConfig {
		return {
			isConfigured: this.isConfigured(),
			embedderProvider: this.embedderProvider,
			modelId: this.modelId,
			modelDimension: this.modelDimension,
			openAiOptions: this.openAiOptions,
			ollamaOptions: this.ollamaOptions,
			openAiCompatibleOptions: this.openAiCompatibleOptions,
			geminiOptions: this.geminiOptions,
			modelHarborOptions: this.modelHarborOptions,
			qdrantUrl: this.qdrantUrl,
			qdrantApiKey: this.qdrantApiKey,
			searchMinScore: this.currentSearchMinScore,
			searchMaxResults: this.currentSearchMaxResults,
		}
	}

	/**
	 * Gets whether the code indexing feature is enabled
	 */
	public get isFeatureEnabled(): boolean {
		return this.codebaseIndexEnabled
	}

	/**
	 * Gets whether the code indexing feature is properly configured
	 */
	public get isFeatureConfigured(): boolean {
		return this.isConfigured()
	}

	/**
	 * Gets the current embedder type
	 */
	public get currentEmbedderProvider(): EmbedderProvider {
		return this.embedderProvider
	}

	/**
	 * Gets the current Qdrant configuration
	 */
	public get qdrantConfig(): { url?: string; apiKey?: string } {
		return {
			url: this.qdrantUrl,
			apiKey: this.qdrantApiKey,
		}
	}

	/**
	 * Gets the current model ID being used for embeddings.
	 */
	public get currentModelId(): string | undefined {
		return this.modelId
	}

	/**
	 * Gets the current model dimension being used for embeddings.
	 * Returns the model's built-in dimension if available, otherwise falls back to custom dimension.
	 */
	public get currentModelDimension(): number | undefined {
		// First try to get the model-specific dimension
		const modelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
		const modelDimension = getModelDimension(this.embedderProvider, modelId)

		// Only use custom dimension if model doesn't have a built-in dimension
		if (!modelDimension && this.modelDimension && this.modelDimension > 0) {
			return this.modelDimension
		}

		return modelDimension
	}

	/**
	 * Gets the configured minimum search score
	 */
	public get currentSearchMinScore(): number {
		if (this.searchMinScore !== undefined) {
			return this.searchMinScore
		}

		const currentModelId = this.modelId ?? getDefaultModelId(this.embedderProvider)
		const modelSpecificThreshold = getModelScoreThreshold(this.embedderProvider, currentModelId)
		return modelSpecificThreshold ?? DEFAULT_SEARCH_MIN_SCORE
	}

	/**
	 * Gets the configured maximum search results.
	 */
	public get currentSearchMaxResults(): number {
		return this.searchMaxResults ?? DEFAULT_MAX_SEARCH_RESULTS
	}
}
