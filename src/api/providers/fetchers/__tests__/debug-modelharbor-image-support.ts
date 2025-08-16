/**
 * Diagnostic script to debug ModelHarbor image support issues
 *
 * Run this script to check:
 * 1. What the ModelHarbor API returns for a specific model
 * 2. How the app processes that data
 * 3. What gets cached and sent to the frontend
 */

import { getModelHarborModels } from "../modelharbor"

async function debugModelHarborImageSupport() {
	console.log("🔍 Debugging ModelHarbor Image Support\n")
	console.log("=".repeat(80))

	try {
		// Fetch models from the API
		console.log("\n📡 Fetching models from ModelHarbor API...")
		const models = await getModelHarborModels()

		console.log(`✅ Fetched ${Object.keys(models).length} models\n`)

		// Check for the user's specific models that should support images
		const testModelNames = [
			"anthropic/claude-haiku-4.5-code",
			"anthropic/claude-sonnet-4.5-code",
			"anthropic/claude-haiku-4.5",
		]

		console.log("🔎 Checking specific models for image support:\n")

		for (const modelName of testModelNames) {
			const modelInfo = models[modelName]

			if (modelInfo) {
				console.log(`✓ Found: ${modelName}`)
				console.log(`  └─ supportsImages: ${modelInfo.supportsImages}`)
				console.log(`  └─ maxTokens: ${modelInfo.maxTokens}`)
				console.log(`  └─ contextWindow: ${modelInfo.contextWindow}`)
				console.log()
			} else {
				console.log(`✗ Not found: ${modelName}\n`)
			}
		}

		// Show all models with image support
		console.log("=".repeat(80))
		console.log("\n📋 All models with image support:\n")

		const imageModels = Object.entries(models).filter(([_, info]) => info.supportsImages)

		if (imageModels.length === 0) {
			console.log("⚠️  NO MODELS WITH IMAGE SUPPORT FOUND!")
			console.log("\nThis is the problem! The API returned models but none have supportsImages: true")
		} else {
			imageModels.forEach(([name, info]) => {
				console.log(`  🖼️  ${name}`)
				console.log(`     └─ maxTokens: ${info.maxTokens}`)
				console.log(`     └─ contextWindow: ${info.contextWindow}`)
			})
		}

		// Show all models WITHOUT image support
		console.log("\n" + "=".repeat(80))
		console.log("\n📋 Models WITHOUT image support:\n")

		const nonImageModels = Object.entries(models).filter(([_, info]) => !info.supportsImages)

		nonImageModels.forEach(([name, info]) => {
			console.log(`  📄 ${name}`)
		})

		// Summary
		console.log("\n" + "=".repeat(80))
		console.log("\n📊 SUMMARY:\n")
		console.log(`  Total models: ${Object.keys(models).length}`)
		console.log(`  With image support: ${imageModels.length}`)
		console.log(`  Without image support: ${nonImageModels.length}`)

		// Diagnostic advice
		console.log("\n" + "=".repeat(80))
		console.log("\n💡 DIAGNOSTIC ADVICE:\n")

		if (imageModels.length === 0) {
			console.log("❌ PROBLEM IDENTIFIED:")
			console.log("   The ModelHarbor API is not returning any models with supportsImages: true")
			console.log("\n🔧 POSSIBLE CAUSES:")
			console.log("   1. The API response format changed and doesn't include supports_vision field")
			console.log("   2. The API is returning different data than expected")
			console.log("   3. There's a caching issue - try flushing the cache")
			console.log("\n💻 NEXT STEPS:")
			console.log("   1. Check the raw API response from https://api.modelharbor.com/v1/model/info")
			console.log("   2. Verify the 'supports_vision' field is present in the API response")
			console.log("   3. Check if the field name or structure has changed")
		} else {
			console.log("✅ Image support is being detected correctly!")
			console.log("\n🔧 If image upload still doesn't work, check:")
			console.log("   1. Is the correct model selected in the UI?")
			console.log("   2. Is the model info being cached correctly?")
			console.log("   3. Are there any errors in the browser console?")
			console.log("   4. Check if routerModels.modelharbor contains the model info")
		}

		console.log("\n" + "=".repeat(80))
	} catch (error) {
		console.error("\n❌ ERROR:", error)
		console.error("\nFailed to fetch models from ModelHarbor API")
	}
}

// Run the diagnostic
debugModelHarborImageSupport().catch(console.error)
