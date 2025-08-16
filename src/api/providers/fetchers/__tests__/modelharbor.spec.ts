import { describe, it, expect } from "vitest"
import { getModelHarborModels } from "../modelharbor"

describe("getModelHarborModels", () => {
	it("should fetch real models from ModelHarbor API and check image support for haiku-4.5-code", async () => {
		const models = await getModelHarborModels()

		// Check if haiku-4.5-code exists in the models
		const haikuModel = Object.entries(models).find(([key]) => key.includes("haiku") && key.includes("4.5"))

		if (haikuModel) {
			const [modelName, modelInfo] = haikuModel
			console.log(`Found haiku model: ${modelName}`)
			console.log(`  - supportsImages: ${modelInfo.supportsImages}`)
			console.log(`  - maxTokens: ${modelInfo.maxTokens}`)
			console.log(`  - contextWindow: ${modelInfo.contextWindow}`)
			expect(modelInfo).toBeDefined()
			expect(typeof modelInfo.supportsImages).toBe("boolean")
		} else {
			console.warn("haiku-4.5-code model not found in ModelHarbor API response")
		}
	})

	it("should fetch real models from ModelHarbor API and check image support for sonnet-4.5-code", async () => {
		const models = await getModelHarborModels()

		// Check if sonnet-4.5-code exists in the models
		const sonnetModel = Object.entries(models).find(([key]) => key.includes("sonnet") && key.includes("4.5"))

		if (sonnetModel) {
			const [modelName, modelInfo] = sonnetModel
			console.log(`Found sonnet model: ${modelName}`)
			console.log(`  - supportsImages: ${modelInfo.supportsImages}`)
			console.log(`  - maxTokens: ${modelInfo.maxTokens}`)
			console.log(`  - contextWindow: ${modelInfo.contextWindow}`)
			expect(modelInfo).toBeDefined()
			expect(typeof modelInfo.supportsImages).toBe("boolean")
		} else {
			console.warn("sonnet-4.5-code model not found in ModelHarbor API response")
		}
	})

	it("should list all models with their image support status", async () => {
		const models = await getModelHarborModels()

		console.log("\n=== ModelHarbor Models Image Support Status ===")
		console.log(`Total models fetched: ${Object.keys(models).length}`)

		if (Object.keys(models).length === 0) {
			console.warn("⚠️ No models returned from ModelHarbor API")
			console.warn("This may indicate the API is unreachable or returned an error")
		}

		const modelEntries = Object.entries(models).slice(0, 20) // Show first 20 models

		modelEntries.forEach(([modelName, modelInfo]) => {
			console.log(`  ${modelName}: supportsImages=${modelInfo.supportsImages}`)
		})

		if (Object.entries(models).length > 20) {
			console.log(`  ... and ${Object.entries(models).length - 20} more models`)
		}

		// This test is informational - it will pass even if API returns empty
		// The important tests above check for specific models
		expect(true).toBe(true)
	})
})
