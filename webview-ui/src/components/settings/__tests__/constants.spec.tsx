import { describe, it, expect } from "vitest"
import { PROVIDERS } from "../constants"

describe("PROVIDERS constants", () => {
	it("should have ModelHarbor as the first provider", () => {
		expect(PROVIDERS[0]).toEqual({
			value: "modelharbor",
			label: "ModelHarbor",
		})
	})

	it("should have other providers sorted alphabetically after ModelHarbor", () => {
		// Get all providers except the first one (ModelHarbor)
		const otherProviders = PROVIDERS.slice(1)

		// Create a sorted version of the other providers
		const sortedOtherProviders = [...otherProviders].sort((a, b) => a.label.localeCompare(b.label))

		// Check that the other providers are already sorted
		expect(otherProviders).toEqual(sortedOtherProviders)
	})

	it("should contain ModelHarbor provider", () => {
		const modelHarborProvider = PROVIDERS.find((provider) => provider.value === "modelharbor")
		expect(modelHarborProvider).toBeDefined()
		expect(modelHarborProvider?.label).toBe("ModelHarbor")
	})

	it("should have ModelHarbor at index 0", () => {
		expect(PROVIDERS.findIndex((provider) => provider.value === "modelharbor")).toBe(0)
	})

	it("should maintain the total number of providers", () => {
		// This test ensures we didn't accidentally remove or duplicate any providers
		const expectedProviderCount = 33 // Update this number based on the actual count (includes DeepInfra, removed Roo)
		expect(PROVIDERS.length).toBe(expectedProviderCount)
	})

	it("should not have duplicate providers", () => {
		const providerValues = PROVIDERS.map((provider) => provider.value)
		const uniqueProviderValues = Array.from(new Set(providerValues))
		expect(providerValues.length).toBe(uniqueProviderValues.length)
	})
})
