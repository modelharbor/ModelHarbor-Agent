import { describe, it, expect } from "vitest"
import { getModelHarborModels, clearModelHarborCache } from "../modelharbor.js"
import type { ModelInfo } from "../../model.js"

describe("ModelHarbor Tool Protocol Selection (Types Package)", () => {
	it("should set defaultToolProtocol to native for haiku-4.5 models from real API", async () => {
		// Clear cache to ensure fresh fetch
		clearModelHarborCache()

		const models = await getModelHarborModels()

		// Check if haiku-4.5 models exist and have native protocol
		const haikuModel = models["anthropic/claude-haiku-4.5"]
		if (haikuModel) {
			expect(haikuModel.defaultToolProtocol).toBe("native")
		}

		const haikuCodeModel = models["anthropic/claude-haiku-4.5-code"]
		if (haikuCodeModel) {
			expect(haikuCodeModel.defaultToolProtocol).toBe("native")
		}

		// At least one haiku-4.5 model should exist
		expect(haikuModel || haikuCodeModel).toBeTruthy()
	})

	it("should set defaultToolProtocol to native for all models from real API", async () => {
		const models = await getModelHarborModels()

		// Check sonnet models use native protocol (all models now use native)
		const sonnetModel = models["anthropic/claude-sonnet-4.5-code"]
		if (sonnetModel) {
			expect(sonnetModel.defaultToolProtocol).toBe("native")
		}

		const opusModel = models["anthropic/claude-opus-4.5-code"]
		if (opusModel) {
			expect(opusModel.defaultToolProtocol).toBe("native")
		}

		// At least one non-haiku model should exist
		expect(sonnetModel || opusModel).toBeTruthy()
	})

	it("should handle model tool support correctly from real API", async () => {
		const models = await getModelHarborModels()

		// Check that models have the supportsNativeTools field set
		for (const modelInfo of Object.values(models) as ModelInfo[]) {
			// supportsNativeTools should be defined (either true or false)
			expect(modelInfo.supportsNativeTools).toBeDefined()

			// defaultToolProtocol should be defined
			expect(modelInfo.defaultToolProtocol).toBeDefined()
			expect(["xml", "native"]).toContain(modelInfo.defaultToolProtocol)
		}
	})
})
