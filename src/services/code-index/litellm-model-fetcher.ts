/**
 * Utility to fetch embedding models from the LiteLLM /v1/model/info API.
 *
 * Filtering criteria: only models whose `model_info.dimension` is a number > 0
 * are considered embedding models.
 */

import * as path from "path"
import * as fs from "fs/promises"
import * as fsSync from "fs"

import NodeCache from "node-cache"

import { safeWriteJson } from "../../utils/safeWriteJson"
import { getCacheDirectoryPath } from "../../utils/storage"
import { fileExistsAtPath } from "../../utils/fs"

export interface LiteLLMEmbeddingModel {
	/** model_name from the API response */
	modelId: string
	/** model_info.dimension */
	dimension: number
	/** model_info.input_cost_per_token (optional) */
	inputCostPerToken?: number
}

/**
 * Normalize a base URL by removing trailing slashes and a trailing `/v1` segment
 * so that we can consistently append `/v1/model/info`.
 */
function normalizeBaseUrl(baseUrl: string): string {
	let url = baseUrl.trim()
	// Remove trailing slashes
	url = url.replace(/\/+$/, "")
	// Remove trailing /v1 (case-insensitive)
	url = url.replace(/\/v1$/i, "")
	return url
}

/**
 * Fetch embedding models from a LiteLLM-compatible `/v1/model/info` endpoint.
 *
 * @param baseUrl - The LiteLLM base URL (e.g. "http://localhost:4000" or "http://localhost:4000/v1")
 * @param apiKey  - Optional API key for Authorization header
 * @returns Array of embedding models sorted by modelId, or empty array on failure
 */
export async function fetchLiteLLMEmbeddingModels(baseUrl: string, apiKey?: string): Promise<LiteLLMEmbeddingModel[]> {
	try {
		const normalizedUrl = normalizeBaseUrl(baseUrl)
		const url = `${normalizedUrl}/v1/model/info`

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		if (apiKey) {
			headers["Authorization"] = `Bearer ${apiKey}`
		}

		const response = await fetch(url, { headers })

		if (!response.ok) {
			console.error(`LiteLLM model/info request failed: ${response.status} ${response.statusText}`)
			return []
		}

		const body = await response.json()

		// The API returns { data: [...] }
		const data = body?.data
		if (!Array.isArray(data)) {
			console.error("LiteLLM model/info: unexpected response format, expected { data: [...] }")
			return []
		}

		const embeddingModels: LiteLLMEmbeddingModel[] = []

		for (const entry of data) {
			const modelName = entry?.model_name
			const modelInfo = entry?.model_info
			const dimension = modelInfo?.dimension

			// Filter: dimension must be a number > 0
			if (typeof dimension === "number" && dimension > 0 && typeof modelName === "string") {
				embeddingModels.push({
					modelId: modelName,
					dimension,
					inputCostPerToken:
						typeof modelInfo.input_cost_per_token === "number" ? modelInfo.input_cost_per_token : undefined,
				})
			}
		}

		// Sort by modelId alphabetically
		embeddingModels.sort((a, b) => a.modelId.localeCompare(b.modelId))

		return embeddingModels
	} catch (error) {
		console.error("Failed to fetch LiteLLM embedding models:", error)
		return []
	}
}

// --- Cache Layer ---

const CACHE_KEY = "litellm_embedding_models"
const CACHE_FILENAME = "litellm_embedding_models.json"
const MEMORY_CACHE_TTL_SECONDS = 5 * 60 // 5 minutes

const memoryCache = new NodeCache({ stdTTL: MEMORY_CACHE_TTL_SECONDS, checkperiod: MEMORY_CACHE_TTL_SECONDS })

// Track in-flight refresh to prevent concurrent API calls
const inFlightRefresh = new Map<string, Promise<LiteLLMEmbeddingModel[]>>()

/**
 * Build a cache key from baseUrl to differentiate caches for different LiteLLM instances.
 */
function buildCacheKey(baseUrl: string): string {
	return `${CACHE_KEY}:${normalizeBaseUrl(baseUrl)}`
}

/**
 * Write embedding models to disk cache.
 */
async function writeDiskCache(globalStoragePath: string, models: LiteLLMEmbeddingModel[]): Promise<void> {
	const cacheDir = await getCacheDirectoryPath(globalStoragePath)
	await safeWriteJson(path.join(cacheDir, CACHE_FILENAME), models)
}

/**
 * Read embedding models from disk cache (async).
 */
async function readDiskCache(globalStoragePath: string): Promise<LiteLLMEmbeddingModel[] | undefined> {
	const cacheDir = await getCacheDirectoryPath(globalStoragePath)
	const filePath = path.join(cacheDir, CACHE_FILENAME)
	const exists = await fileExistsAtPath(filePath)
	if (!exists) {
		return undefined
	}
	try {
		const data = await fs.readFile(filePath, "utf8")
		const parsed = JSON.parse(data)
		if (Array.isArray(parsed)) {
			return parsed
		}
		return undefined
	} catch {
		return undefined
	}
}

/**
 * Read embedding models from disk cache (sync, for cold-start fallback).
 */
function readDiskCacheSync(globalStoragePath: string): LiteLLMEmbeddingModel[] | undefined {
	try {
		const cachePath = path.join(globalStoragePath, "cache")
		const filePath = path.join(cachePath, CACHE_FILENAME)
		if (fsSync.existsSync(filePath)) {
			const data = fsSync.readFileSync(filePath, "utf8")
			const parsed = JSON.parse(data)
			if (Array.isArray(parsed)) {
				return parsed
			}
		}
	} catch {
		// Silently fail on disk read errors
	}
	return undefined
}

/**
 * Get cached LiteLLM embedding models with multi-level cache strategy:
 * - Memory cache (NodeCache, 5 min TTL)
 * - Disk cache (JSON file)
 * - API fetch (fallback)
 *
 * Supports force refresh, in-flight dedup, and graceful degradation.
 *
 * @param baseUrl - LiteLLM base URL
 * @param apiKey - Optional API key
 * @param globalStoragePath - Global storage path for disk cache
 * @param forceRefresh - If true, bypass cache and fetch from API
 * @returns Array of embedding models
 */
export async function getCachedLiteLLMEmbeddingModels(
	baseUrl: string,
	apiKey: string | undefined,
	globalStoragePath: string,
	forceRefresh: boolean = false,
): Promise<LiteLLMEmbeddingModel[]> {
	const cacheKey = buildCacheKey(baseUrl)

	if (!forceRefresh) {
		// 1. Check memory cache
		const memModels = memoryCache.get<LiteLLMEmbeddingModel[]>(cacheKey)
		if (memModels && memModels.length > 0) {
			return memModels
		}

		// 2. Check disk cache
		const diskModels = await readDiskCache(globalStoragePath)
		if (diskModels && diskModels.length > 0) {
			// Populate memory cache for fast subsequent access
			memoryCache.set(cacheKey, diskModels)
			return diskModels
		}
	}

	// 3. Fetch from API (with in-flight dedup)
	const existingRequest = inFlightRefresh.get(cacheKey)
	if (existingRequest) {
		return existingRequest
	}

	const fetchPromise = (async (): Promise<LiteLLMEmbeddingModel[]> => {
		try {
			const models = await fetchLiteLLMEmbeddingModels(baseUrl, apiKey)

			if (models.length > 0) {
				// Update memory cache
				memoryCache.set(cacheKey, models)
				// Update disk cache (fire and forget, don't block)
				writeDiskCache(globalStoragePath, models).catch((err) =>
					console.error("[LiteLLM Embedding Cache] Error writing disk cache:", err),
				)
				return models
			}

			// API returned empty — graceful degradation: return stale cache
			const staleMemory = memoryCache.get<LiteLLMEmbeddingModel[]>(cacheKey)
			if (staleMemory && staleMemory.length > 0) {
				return staleMemory
			}
			const staleDisk = readDiskCacheSync(globalStoragePath)
			if (staleDisk && staleDisk.length > 0) {
				return staleDisk
			}

			return []
		} catch (error) {
			console.error("[LiteLLM Embedding Cache] Fetch failed, attempting graceful degradation:", error)

			// Graceful degradation: return any available cache
			const staleMemory = memoryCache.get<LiteLLMEmbeddingModel[]>(cacheKey)
			if (staleMemory && staleMemory.length > 0) {
				return staleMemory
			}
			const staleDisk = readDiskCacheSync(globalStoragePath)
			if (staleDisk && staleDisk.length > 0) {
				return staleDisk
			}

			return []
		} finally {
			inFlightRefresh.delete(cacheKey)
		}
	})()

	inFlightRefresh.set(cacheKey, fetchPromise)
	return fetchPromise
}

// Exported for testing
export { memoryCache as _memoryCache, inFlightRefresh as _inFlightRefresh, buildCacheKey as _buildCacheKey }
