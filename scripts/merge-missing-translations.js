/**
 * Script to automatically merge missing translation keys from English to Thai files
 * This script will add missing keys with Thai translations to the corresponding th/*.json files
 */

const fs = require("fs")
const path = require("path")

// Paths to the locales directories
const LOCALES_DIRS = {
	core: path.join(__dirname, "../src/i18n/locales"),
	webview: path.join(__dirname, "../webview-ui/src/i18n/locales"),
}

// Thai translations for the missing keys
const translations = {
	// Backend/Core translations
	core: {
		"common.json": {
			"errors.url_request_aborted":
				"คำขอดึงข้อมูล URL ถูกยกเลิก อาจเกิดขึ้นได้หากเว็บไซต์บล็อกการเข้าถึงอัตโนมัติ ต้องการการยืนยันตัวตน หรือมีปัญหาเครือข่าย กรุณาลองอีกครั้งหรือตรวจสอบว่า URL สามารถเข้าถึงได้ในเบราว์เซอร์ปกติ",
			"errors.cerebras.authenticationFailed":
				"การยืนยันตัวตน Cerebras API ล้มเหลว กรุณาตรวจสอบว่าคีย์ API ของคุณถูกต้องและไม่หมดอายุ",
			"errors.cerebras.accessForbidden":
				"การเข้าถึง Cerebras API ถูกห้าม คีย์ API ของคุณอาจไม่มีสิทธิ์เข้าถึงโมเดลหรือคุณสมบัติที่ร้องขอ",
			"errors.cerebras.rateLimitExceeded": "เกินขีดจำกัดอัตรา Cerebras API กรุณารอก่อนทำคำขออีกครั้ง",
			"errors.cerebras.serverError": "ข้อผิดพลาดเซิร์ฟเวอร์ Cerebras API ({{status}}) กรุณาลองอีกครั้งภายหลัง",
			"errors.cerebras.genericError": "ข้อผิดพลาด Cerebras API ({{status}}): {{message}}",
			"errors.cerebras.noResponseBody": "ข้อผิดพลาด Cerebras API: ไม่มีเนื้อหาการตอบกลับ",
			"errors.cerebras.completionError": "ข้อผิดพลาดการทำงานสมบูรณ์ Cerebras: {{error}}",
		},
		"embeddings.json": {
			"modelharbor.invalidResponseFormat": "รูปแบบการตอบกลับจาก ModelHarbor API ไม่ถูกต้อง",
			"serviceFactory.modelHarborConfigMissing": "การกำหนดค่า ModelHarbor หายไปสำหรับการสร้าง embedder",
		},
	},
	// Frontend/Webview translations
	webview: {
		"account.json": {
			cloudBenefitWalkaway: "ติดตามและควบคุมงานจากทุกที่ด้วย Roomote Control",
			remoteControl: "Roomote Control",
			remoteControlDescription: "เปิดใช้งานการติดตามและโต้ตอบกับงานในพื้นที่ทำงานนี้ด้วย ModelHarbor Agent Cloud",
		},
		"chat.json": {
			"task.expand": "ขยายงาน",
			"task.collapse": "ย่องาน",
		},
		"settings.json": {
			"codeIndex.validation.modelharborApiKeyRequired": "ต้องการคีย์ API ModelHarbor",
			"providers.getRequestyBaseUrl": "URL ฐาน",
			"providers.requestyUseCustomBaseUrl": "ใช้ URL ฐานที่กำหนดเอง",
			"providers.anthropic1MContextBetaLabel": "เปิดใช้งานหน้าต่างบริบท 1M (เบต้า)",
			"providers.anthropic1MContextBetaDescription": "ขยายหน้าต่างบริบทเป็น 1 ล้านโทเค็นสำหรับ Claude Sonnet 4",
			"providers.awsBedrock1MContextBetaLabel": "เปิดใช้งานหน้าต่างบริบท 1M (เบต้า)",
			"providers.awsBedrock1MContextBetaDescription": "ขยายหน้าต่างบริบทเป็น 1 ล้านโทเค็นสำหรับ Claude Sonnet 4",
			"providers.ioIntelligenceApiKey": "คีย์ API IO Intelligence",
			"providers.ioIntelligenceApiKeyPlaceholder": "ใส่คีย์ API IO Intelligence ของคุณ",
			"providers.getIoIntelligenceApiKey": "รับคีย์ API IO Intelligence",
			"providers.reasoningEffort.minimal": "น้อยที่สุด (เร็วที่สุด)",
			"modelInfo.contextWindow": "หน้าต่างบริบท:",
		},
	},
}

// Utility functions
function setNestedValue(obj, path, value) {
	const keys = path.split(".")
	let current = obj

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i]
		if (!(key in current) || typeof current[key] !== "object") {
			current[key] = {}
		}
		current = current[key]
	}

	current[keys[keys.length - 1]] = value
}

function mergeTranslations(area) {
	console.log(`\nMerging translations for ${area.toUpperCase()}...`)

	const localesDir = LOCALES_DIRS[area]
	const thDir = path.join(localesDir, "th")
	const areaTranslations = translations[area]

	if (!areaTranslations) {
		console.log(`No translations defined for ${area}`)
		return
	}

	let totalAdded = 0

	for (const [filename, fileTranslations] of Object.entries(areaTranslations)) {
		const filePath = path.join(thDir, filename)

		if (!fs.existsSync(filePath)) {
			console.log(`Warning: File ${filePath} does not exist, skipping...`)
			continue
		}

		// Read existing Thai file
		let thContent
		try {
			const content = fs.readFileSync(filePath, "utf8")
			thContent = JSON.parse(content)
		} catch (error) {
			console.error(`Error reading ${filePath}:`, error)
			continue
		}

		// Add missing translations
		let addedCount = 0
		for (const [key, translation] of Object.entries(fileTranslations)) {
			// Check if key already exists
			const keys = key.split(".")
			let current = thContent
			let exists = true

			for (const k of keys) {
				if (!(k in current)) {
					exists = false
					break
				}
				current = current[k]
			}

			if (!exists) {
				setNestedValue(thContent, key, translation)
				addedCount++
				console.log(`  Added: ${key}`)
			}
		}

		if (addedCount > 0) {
			// Write back to file with proper formatting
			try {
				fs.writeFileSync(filePath, JSON.stringify(thContent, null, 2) + "\n", "utf8")
				console.log(`  Updated ${filename}: ${addedCount} translations added`)
				totalAdded += addedCount
			} catch (error) {
				console.error(`Error writing ${filePath}:`, error)
			}
		} else {
			console.log(`  ${filename}: No new translations needed`)
		}
	}

	console.log(`Total translations added for ${area}: ${totalAdded}`)
}

// Main function
function main() {
	console.log("Starting translation merge process...")

	try {
		// Merge translations for both areas
		mergeTranslations("core")
		mergeTranslations("webview")

		console.log("\n✅ Translation merge completed!")
		console.log("\nNext steps:")
		console.log("1. Review the added translations for accuracy")
		console.log("2. Run 'node scripts/find-missing-translations.js' to verify all translations are complete")
		console.log("3. Test the application to ensure translations display correctly")
	} catch (error) {
		console.error("Error during translation merge:", error)
		process.exit(1)
	}
}

// Run the script
main()
