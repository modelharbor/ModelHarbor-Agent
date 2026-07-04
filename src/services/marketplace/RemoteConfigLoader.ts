import axios from "axios"
import * as yaml from "yaml"
import { z } from "zod"

import {
	type MarketplaceItem,
	type MarketplaceItemType,
	modeMarketplaceItemSchema,
	mcpMarketplaceItemSchema,
} from "@roo-code/types"

// Using z.any() to avoid deep type instantiation from modeMarketplaceItemSchema
const modeMarketplaceResponse = z.object({
	items: z.array(z.any()),
})

const mcpMarketplaceResponse = z.object({
	items: z.array(z.any()),
})

export class RemoteConfigLoader {
	private apiBaseUrl: string
	private cache: Map<string, { data: MarketplaceItem[]; timestamp: number }> = new Map()
	private cacheDuration = 5 * 60 * 1000 // 5 minutes

	constructor() {
		this.apiBaseUrl = "https://app.roocode.com"
	}

	async loadAllItems(hideMarketplaceMcps = false): Promise<MarketplaceItem[]> {
		const items: MarketplaceItem[] = []

		const modesPromise = this.fetchModes()
		const mcpsPromise = hideMarketplaceMcps ? Promise.resolve([]) : this.fetchMcps()

		// Fetch modes and MCPs independently: a failure fetching one (e.g. the
		// MCP endpoint is temporarily down) must not discard the other. Using
		// Promise.allSettled keeps whichever list succeeded and only empties
		// the one that failed, instead of zeroing out the whole marketplace.
		const [modesSettled, mcpsSettled] = await Promise.allSettled([modesPromise, mcpsPromise])

		const modes = modesSettled.status === "fulfilled" ? modesSettled.value : []
		const mcps = mcpsSettled.status === "fulfilled" ? mcpsSettled.value : []

		if (modesSettled.status === "rejected") {
			console.error("Failed to fetch marketplace modes:", modesSettled.reason)
		}
		if (mcpsSettled.status === "rejected") {
			console.error("Failed to fetch marketplace MCPs:", mcpsSettled.reason)
		}

		items.push(...modes, ...mcps)
		return items
	}

	private async fetchModes(): Promise<MarketplaceItem[]> {
		const cacheKey = "modes"
		const cached = this.getFromCache(cacheKey)

		if (cached) {
			return cached
		}

		const data = await this.fetchWithRetry<string>(`${this.apiBaseUrl}/api/marketplace/modes`)

		const yamlData = yaml.parse(data)
		const validated = modeMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mode" as const,
			...item,
		}))

		this.setCache(cacheKey, items)
		return items
	}

	private async fetchMcps(): Promise<MarketplaceItem[]> {
		const cacheKey = "mcps"
		const cached = this.getFromCache(cacheKey)

		if (cached) {
			return cached
		}

		const data = await this.fetchWithRetry<string>(`${this.apiBaseUrl}/api/marketplace/mcps`)

		const yamlData = yaml.parse(data)
		const validated = mcpMarketplaceResponse.parse(yamlData)

		const items: MarketplaceItem[] = validated.items.map((item) => ({
			type: "mcp" as const,
			...item,
		}))

		this.setCache(cacheKey, items)
		return items
	}

	private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
		let lastError: Error

		for (let i = 0; i < maxRetries; i++) {
			try {
				const response = await axios.get(url, {
					timeout: 10000, // 10 second timeout
					headers: {
						Accept: "application/x-yaml, application/json",
					},
				})
				return response.data as T
			} catch (error) {
				lastError = error as Error
				if (i < maxRetries - 1) {
					// Exponential backoff: 1s, 2s, 4s
					const delay = Math.pow(2, i) * 1000
					await new Promise((resolve) => setTimeout(resolve, delay))
				}
			}
		}

		throw lastError!
	}

	async getItem(id: string, type: MarketplaceItemType): Promise<MarketplaceItem | null> {
		const items = await this.loadAllItems()
		return items.find((item) => item.id === id && item.type === type) || null
	}

	private getFromCache(key: string): MarketplaceItem[] | null {
		const cached = this.cache.get(key)
		if (!cached) return null

		const now = Date.now()
		if (now - cached.timestamp > this.cacheDuration) {
			this.cache.delete(key)
			return null
		}

		return cached.data
	}

	private setCache(key: string, data: MarketplaceItem[]): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		})
	}

	clearCache(): void {
		this.cache.clear()
	}
}
