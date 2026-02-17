import {
	fetchLiteLLMEmbeddingModels,
	getCachedLiteLLMEmbeddingModels,
	_memoryCache,
	_inFlightRefresh,
	_buildCacheKey,
} from "../litellm-model-fetcher"

import { safeWriteJson } from "../../../utils/safeWriteJson"
import { getCacheDirectoryPath } from "../../../utils/storage"
import { fileExistsAtPath } from "../../../utils/fs"
import * as fsPromises from "fs/promises"
import * as fsSync from "fs"

// Mock safeWriteJson
vi.mock("../../../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

// Mock getCacheDirectoryPath
vi.mock("../../../utils/storage", () => ({
	getCacheDirectoryPath: vi.fn().mockResolvedValue("/mock/global/cache"),
}))

// Mock fileExistsAtPath
vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

// Mock fs/promises
vi.mock("fs/promises", () => ({
	readFile: vi.fn().mockRejectedValue(new Error("not found")),
}))

// Mock fs (sync)
vi.mock("fs", () => ({
	existsSync: vi.fn().mockReturnValue(false),
	readFileSync: vi.fn().mockImplementation(() => {
		throw new Error("not found")
	}),
}))

// We need to access the non-exported normalizeBaseUrl via module internals
// Since it's not exported, we'll test it indirectly through fetchLiteLLMEmbeddingModels

// Mock console methods
const consoleMocks = {
	error: vitest.spyOn(console, "error").mockImplementation(() => {}),
}

describe("fetchLiteLLMEmbeddingModels", () => {
	let originalFetch: typeof global.fetch

	beforeEach(() => {
		vitest.clearAllMocks()
		consoleMocks.error.mockClear()
		originalFetch = global.fetch
	})

	afterEach(() => {
		global.fetch = originalFetch
	})

	/**
	 * Sample test data matching the LiteLLM /v1/model/info API response format
	 */
	const sampleModelInfoResponse = {
		data: [
			{
				model_name: "baai/bge-m3",
				model_info: { dimension: 1024, input_cost_per_token: 5e-8, output_cost_per_token: 0 },
			},
			{
				model_name: "qwen/qwen3-embedding-4b",
				model_info: { dimension: 2056, input_cost_per_token: 5e-8, output_cost_per_token: 0 },
			},
			{
				model_name: "gpt-4o",
				model_info: { input_cost_per_token: 0.01, output_cost_per_token: 0.03 },
			},
			{
				model_name: "text-embedding-no-dim",
				model_info: { dimension: 0 },
			},
		],
	}

	describe("normalizeBaseUrl (tested indirectly via URL construction)", () => {
		it("should call correct URL when baseUrl has no trailing slash", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:4000/v1/model/info",
				expect.objectContaining({
					headers: expect.objectContaining({
						"Content-Type": "application/json",
					}),
				}),
			)
		})

		it("should strip trailing slash before constructing URL", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000/")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/v1/model/info", expect.any(Object))
		})

		it("should strip trailing /v1 before constructing URL", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000/v1")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/v1/model/info", expect.any(Object))
		})

		it("should strip trailing /v1/ before constructing URL", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000/v1/")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/v1/model/info", expect.any(Object))
		})

		it("should not modify URL that has no trailing slash or /v1", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("https://my-litellm-proxy.example.com")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith(
				"https://my-litellm-proxy.example.com/v1/model/info",
				expect.any(Object),
			)
		})
	})

	describe("filtering models", () => {
		it("should only return models with dimension > 0", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleModelInfoResponse),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert - should only include baai/bge-m3 and qwen/qwen3-embedding-4b
			expect(result).toHaveLength(2)
			expect(result.map((m) => m.modelId)).toEqual(["baai/bge-m3", "qwen/qwen3-embedding-4b"])
		})

		it("should not return models without dimension (chat models like gpt-4o)", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								model_name: "gpt-4o",
								model_info: { input_cost_per_token: 0.01, output_cost_per_token: 0.03 },
							},
						],
					}),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toHaveLength(0)
		})

		it("should not return models with dimension = 0", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								model_name: "zero-dim-model",
								model_info: { dimension: 0 },
							},
						],
					}),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toHaveLength(0)
		})

		it("should not return models with dimension = null", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								model_name: "null-dim-model",
								model_info: { dimension: null },
							},
						],
					}),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toHaveLength(0)
		})

		it("should not return models with dimension = undefined", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								model_name: "undef-dim-model",
								model_info: { dimension: undefined },
							},
						],
					}),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toHaveLength(0)
		})
	})

	describe("sorting", () => {
		it("should sort models alphabetically by modelId", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{ model_name: "zebra-embed", model_info: { dimension: 512 } },
							{ model_name: "alpha-embed", model_info: { dimension: 768 } },
							{ model_name: "mid-embed", model_info: { dimension: 1024 } },
						],
					}),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result.map((m) => m.modelId)).toEqual(["alpha-embed", "mid-embed", "zebra-embed"])
		})
	})

	describe("result structure", () => {
		it("should return models with correct structure including inputCostPerToken", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleModelInfoResponse),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result[0]).toEqual({
				modelId: "baai/bge-m3",
				dimension: 1024,
				inputCostPerToken: 5e-8,
			})
			expect(result[1]).toEqual({
				modelId: "qwen/qwen3-embedding-4b",
				dimension: 2056,
				inputCostPerToken: 5e-8,
			})
		})

		it("should set inputCostPerToken as undefined when not a number", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						data: [
							{
								model_name: "embed-no-cost",
								model_info: { dimension: 768 },
							},
						],
					}),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result[0]).toEqual({
				modelId: "embed-no-cost",
				dimension: 768,
				inputCostPerToken: undefined,
			})
		})
	})

	describe("error handling", () => {
		it("should return empty array when fetch fails with network error", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockRejectedValue(new Error("Network error"))
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toEqual([])
		})

		it("should return empty array when response is not ok (e.g., 500)", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toEqual([])
		})

		it("should return empty array when response is not valid JSON", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.reject(new Error("Invalid JSON")),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toEqual([])
		})

		it("should return empty array when response data is not an array", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: "not-an-array" }),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toEqual([])
		})

		it("should return empty array when response has no data field", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ models: [] }),
			})
			global.fetch = mockFetch

			// Act
			const result = await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(result).toEqual([])
		})
	})

	describe("authentication", () => {
		it("should send Authorization header when apiKey is provided", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000", "sk-my-api-key")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer sk-my-api-key",
					},
				}),
			)
		})

		it("should not send Authorization header when apiKey is not provided", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: {
						"Content-Type": "application/json",
					},
				}),
			)
			// Ensure Authorization is NOT in headers
			const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
			expect(calledHeaders).not.toHaveProperty("Authorization")
		})

		it("should not send Authorization header when apiKey is empty string", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000", "")

			// Assert
			const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
			expect(calledHeaders).not.toHaveProperty("Authorization")
		})
	})

	describe("URL construction (fetch)", () => {
		it("should call correct URL ({baseUrl}/v1/model/info)", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("http://localhost:4000")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith("http://localhost:4000/v1/model/info", expect.any(Object))
		})

		it("should handle baseUrl with port and path correctly", async () => {
			// Arrange
			const mockFetch = vitest.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act
			await fetchLiteLLMEmbeddingModels("https://my-proxy.example.com:8443/api")

			// Assert
			expect(mockFetch).toHaveBeenCalledWith(
				"https://my-proxy.example.com:8443/api/v1/model/info",
				expect.any(Object),
			)
		})
	})
})

describe("getCachedLiteLLMEmbeddingModels", () => {
	let originalFetch: typeof global.fetch

	const sampleModels = [
		{ modelId: "embed-a", dimension: 768, inputCostPerToken: 1e-7 },
		{ modelId: "embed-b", dimension: 1024, inputCostPerToken: 5e-8 },
	]

	const sampleApiResponse = {
		data: [
			{ model_name: "embed-a", model_info: { dimension: 768, input_cost_per_token: 1e-7 } },
			{ model_name: "embed-b", model_info: { dimension: 1024, input_cost_per_token: 5e-8 } },
		],
	}

	beforeEach(() => {
		vitest.clearAllMocks()
		consoleMocks.error.mockClear()
		originalFetch = global.fetch

		// Reset memory cache and in-flight map between tests
		_memoryCache.flushAll()
		_inFlightRefresh.clear()

		// Reset mocks to defaults
		vi.mocked(safeWriteJson).mockResolvedValue(undefined)
		vi.mocked(getCacheDirectoryPath).mockResolvedValue("/mock/global/cache")
		vi.mocked(fileExistsAtPath).mockResolvedValue(false)
		vi.mocked(fsPromises.readFile).mockRejectedValue(new Error("not found"))
		vi.mocked(fsSync.existsSync).mockReturnValue(false)
		vi.mocked(fsSync.readFileSync).mockImplementation(() => {
			throw new Error("not found")
		})
	})

	afterEach(() => {
		global.fetch = originalFetch
	})

	describe("memory cache", () => {
		it("should return models from memory cache when available (forceRefresh=false)", async () => {
			// Arrange — populate memory cache
			const cacheKey = _buildCacheKey("http://localhost:4000")
			_memoryCache.set(cacheKey, sampleModels)

			const mockFetch = vi.fn()
			global.fetch = mockFetch

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				false,
			)

			// Assert — should NOT call API
			expect(mockFetch).not.toHaveBeenCalled()
			expect(result).toEqual(sampleModels)
		})

		it("should skip memory cache when forceRefresh=true", async () => {
			// Arrange — populate memory cache
			const cacheKey = _buildCacheKey("http://localhost:4000")
			_memoryCache.set(cacheKey, sampleModels)

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleApiResponse),
			})
			global.fetch = mockFetch

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				true,
			)

			// Assert — should call API even though memory cache exists
			expect(mockFetch).toHaveBeenCalledTimes(1)
			expect(result).toEqual(sampleModels)
		})
	})

	describe("disk cache", () => {
		it("should return models from disk cache when memory cache is empty", async () => {
			// Arrange — disk cache exists with models
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(sampleModels) as any)

			const mockFetch = vi.fn()
			global.fetch = mockFetch

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				false,
			)

			// Assert — should NOT call API
			expect(mockFetch).not.toHaveBeenCalled()
			expect(result).toEqual(sampleModels)

			// Should have populated memory cache
			const cacheKey = _buildCacheKey("http://localhost:4000")
			expect(_memoryCache.get(cacheKey)).toEqual(sampleModels)
		})

		it("should skip disk cache when forceRefresh=true", async () => {
			// Arrange — disk cache exists
			vi.mocked(fileExistsAtPath).mockResolvedValue(true)
			vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(sampleModels) as any)

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleApiResponse),
			})
			global.fetch = mockFetch

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				true,
			)

			// Assert — should call API despite disk cache
			expect(mockFetch).toHaveBeenCalledTimes(1)
			expect(result).toEqual(sampleModels)
		})
	})

	describe("API fetch + cache update", () => {
		it("should fetch from API when both caches are empty", async () => {
			// Arrange — no cache
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleApiResponse),
			})
			global.fetch = mockFetch

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				"sk-key",
				"/mock/global",
				false,
			)

			// Assert
			expect(mockFetch).toHaveBeenCalledTimes(1)
			expect(result).toEqual(sampleModels)

			// Should have updated memory cache
			const cacheKey = _buildCacheKey("http://localhost:4000")
			expect(_memoryCache.get(cacheKey)).toEqual(sampleModels)
		})

		it("should write disk cache after successful API fetch", async () => {
			// Arrange
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleApiResponse),
			})
			global.fetch = mockFetch

			// Act
			await getCachedLiteLLMEmbeddingModels("http://localhost:4000", undefined, "/mock/global", false)

			// Assert — wait for fire-and-forget disk write
			await new Promise((r) => setTimeout(r, 50))
			expect(safeWriteJson).toHaveBeenCalledWith(
				expect.stringContaining("litellm_embedding_models.json"),
				sampleModels,
			)
		})
	})

	describe("graceful degradation", () => {
		it("should return stale memory cache when API returns empty result", async () => {
			// Arrange — populate stale memory cache, then API returns empty
			const cacheKey = _buildCacheKey("http://localhost:4000")
			_memoryCache.set(cacheKey, sampleModels)

			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [] }),
			})
			global.fetch = mockFetch

			// Act — force refresh to bypass cache check but API returns empty
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				true,
			)

			// Assert — should fallback to stale memory cache
			expect(result).toEqual(sampleModels)
		})

		it("should return stale disk cache when API fails and memory cache is empty", async () => {
			// Arrange — API fails, disk cache has data (sync read)
			const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"))
			global.fetch = mockFetch

			vi.mocked(fsSync.existsSync).mockReturnValue(true)
			vi.mocked(fsSync.readFileSync).mockReturnValue(JSON.stringify(sampleModels))

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				true,
			)

			// Assert
			expect(result).toEqual(sampleModels)
		})

		it("should return empty array when API fails and no cache available", async () => {
			// Arrange — API fails, no cache
			const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"))
			global.fetch = mockFetch

			// Act
			const result = await getCachedLiteLLMEmbeddingModels(
				"http://localhost:4000",
				undefined,
				"/mock/global",
				true,
			)

			// Assert
			expect(result).toEqual([])
		})
	})

	describe("in-flight dedup", () => {
		it("should deduplicate concurrent requests for the same baseUrl", async () => {
			// Arrange
			let resolvePromise: (value: any) => void
			const mockFetch = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						resolvePromise = resolve
					}),
			)
			global.fetch = mockFetch

			// Act — fire two concurrent requests
			const promise1 = getCachedLiteLLMEmbeddingModels("http://localhost:4000", undefined, "/mock/global", true)
			const promise2 = getCachedLiteLLMEmbeddingModels("http://localhost:4000", undefined, "/mock/global", true)

			// Resolve the single fetch
			resolvePromise!({
				ok: true,
				json: () => Promise.resolve(sampleApiResponse),
			})

			const [result1, result2] = await Promise.all([promise1, promise2])

			// Assert — only one API call
			expect(mockFetch).toHaveBeenCalledTimes(1)
			expect(result1).toEqual(sampleModels)
			expect(result2).toEqual(sampleModels)
		})

		it("should clean up in-flight map after request completes", async () => {
			// Arrange
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(sampleApiResponse),
			})
			global.fetch = mockFetch

			const cacheKey = _buildCacheKey("http://localhost:4000")

			// Act
			await getCachedLiteLLMEmbeddingModels("http://localhost:4000", undefined, "/mock/global", true)

			// Assert — in-flight map should be cleaned up
			expect(_inFlightRefresh.has(cacheKey)).toBe(false)
		})

		it("should clean up in-flight map even when fetch fails", async () => {
			// Arrange
			const mockFetch = vi.fn().mockRejectedValue(new Error("fail"))
			global.fetch = mockFetch

			const cacheKey = _buildCacheKey("http://localhost:4000")

			// Act
			await getCachedLiteLLMEmbeddingModels("http://localhost:4000", undefined, "/mock/global", true)

			// Assert
			expect(_inFlightRefresh.has(cacheKey)).toBe(false)
		})
	})

	describe("buildCacheKey", () => {
		it("should produce consistent keys for equivalent URLs", () => {
			expect(_buildCacheKey("http://localhost:4000")).toBe(_buildCacheKey("http://localhost:4000/"))
			expect(_buildCacheKey("http://localhost:4000")).toBe(_buildCacheKey("http://localhost:4000/v1"))
			expect(_buildCacheKey("http://localhost:4000")).toBe(_buildCacheKey("http://localhost:4000/v1/"))
		})

		it("should produce different keys for different hosts", () => {
			expect(_buildCacheKey("http://localhost:4000")).not.toBe(_buildCacheKey("http://localhost:5000"))
		})
	})
})
