/**
 * Debug utility to check model info in the frontend
 *
 * Add this to your browser console to debug image upload issues:
 *
 * window.debugModelInfo()
 */

export function debugModelInfo() {
	// Get the extension state from the React context
	const state = (window as any).__EXTENSION_STATE__

	if (!state) {
		console.error("❌ Extension state not found")
		console.log("💡 Try running this after the extension has loaded")
		return
	}

	console.log("🔍 Debugging Model Info\n")
	console.log("=".repeat(80))

	const { apiConfiguration } = state

	if (!apiConfiguration) {
		console.error("❌ No API configuration found")
		return
	}

	console.log("\n📋 Current Configuration:")
	console.log(`  Provider: ${apiConfiguration.apiProvider || "modelharbor"}`)
	console.log(`  Model ID: ${apiConfiguration.modelharborModelId || "(using default)"}`)

	// Check if there's router models data
	const routerModels = (window as any).__ROUTER_MODELS__

	if (routerModels && routerModels.modelharbor) {
		console.log("\n✅ ModelHarbor models available")
		console.log(`  Total models: ${Object.keys(routerModels.modelharbor).length}`)

		const modelId = apiConfiguration.modelharborModelId || "anthropic/claude-haiku-4.5-code"
		const modelInfo = routerModels.modelharbor[modelId]

		if (modelInfo) {
			console.log(`\n📊 Selected Model Info (${modelId}):`)
			console.log(`  └─ supportsImages: ${modelInfo.supportsImages}`)
			console.log(`  └─ maxTokens: ${modelInfo.maxTokens}`)
			console.log(`  └─ contextWindow: ${modelInfo.contextWindow}`)

			if (!modelInfo.supportsImages) {
				console.log("\n❌ PROBLEM: supportsImages is false!")
				console.log("   This is why image upload is disabled")
			} else {
				console.log("\n✅ Model supports images!")
				console.log("   If upload is still disabled, check:")
				console.log("   1. Is the image upload button visible?")
				console.log("   2. Check browser console for other errors")
				console.log("   3. Try selecting the model again")
			}
		} else {
			console.log(`\n❌ Model "${modelId}" not found in router models`)
			console.log("   Available models:")
			Object.keys(routerModels.modelharbor)
				.slice(0, 10)
				.forEach((name) => console.log(`     - ${name}`))
		}

		// Show all models with image support
		console.log("\n" + "=".repeat(80))
		console.log("\n🖼️  Models with image support:\n")
		Object.entries(routerModels.modelharbor)
			.filter(([_, info]: [string, any]) => info.supportsImages)
			.forEach(([name]) => console.log(`  ✓ ${name}`))
	} else {
		console.error("\n❌ No ModelHarbor models found in router models")
		console.log("   This means the models haven't been fetched yet")
		console.log("   Try:")
		console.log("   1. Wait a few seconds for models to load")
		console.log("   2. Check network tab for /v1/model/info request")
		console.log("   3. Try reloading the extension")
	}

	console.log("\n" + "=".repeat(80))
}

// Make it available globally for console access
if (typeof window !== "undefined") {
	;(window as any).debugModelInfo = debugModelInfo
}
