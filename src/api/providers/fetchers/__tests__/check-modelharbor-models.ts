import { getModelHarborModels } from "../modelharbor"

async function checkModels() {
	console.log("🔍 Fetching models from https://api.modelharbor.com/v1/model/info...\n")

	const models = await getModelHarborModels()

	console.log(`✅ Total models fetched: ${Object.keys(models).length}\n`)

	if (Object.keys(models).length === 0) {
		console.warn("⚠️ No models returned from ModelHarbor API")
		return
	}

	// Check for specific models
	console.log("🔎 Searching for haiku-4.5-code models:")
	const haikuModels = Object.entries(models).filter(([key]) => key.includes("haiku") && key.includes("4.5"))
	if (haikuModels.length > 0) {
		haikuModels.forEach(([name, info]) => {
			console.log(`  ✓ ${name}`)
			console.log(`    - supportsImages: ${info.supportsImages}`)
			console.log(`    - maxTokens: ${info.maxTokens}`)
			console.log(`    - contextWindow: ${info.contextWindow}`)
		})
	} else {
		console.log("  ✗ No haiku-4.5-code models found")
	}

	console.log("\n🔎 Searching for sonnet-4.5-code models:")
	const sonnetModels = Object.entries(models).filter(([key]) => key.includes("sonnet") && key.includes("4.5"))
	if (sonnetModels.length > 0) {
		sonnetModels.forEach(([name, info]) => {
			console.log(`  ✓ ${name}`)
			console.log(`    - supportsImages: ${info.supportsImages}`)
			console.log(`    - maxTokens: ${info.maxTokens}`)
			console.log(`    - contextWindow: ${info.contextWindow}`)
		})
	} else {
		console.log("  ✗ No sonnet-4.5-code models found")
	}

	console.log("\n📋 All available models (first 20):")
	Object.entries(models)
		.slice(0, 20)
		.forEach(([name, info]) => {
			const imageIcon = info.supportsImages ? "🖼️ " : "📄"
			console.log(`  ${imageIcon} ${name} - supportsImages: ${info.supportsImages}`)
		})

	if (Object.keys(models).length > 20) {
		console.log(`\n  ... and ${Object.keys(models).length - 20} more models`)
	}
}

checkModels().catch((error) => {
	console.error("Error:", error.message)
	process.exit(1)
})
