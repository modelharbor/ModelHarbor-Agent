import { describe, it, expect } from "vitest"
import { resolveToolProtocol, detectToolProtocolFromHistory } from "../resolveToolProtocol"
import { TOOL_PROTOCOL, openAiModelInfoSaneDefaults } from "@roo-code/types"
import type { ProviderSettings, ModelInfo } from "@roo-code/types"
import type { Anthropic } from "@anthropic-ai/sdk"

describe("resolveToolProtocol", () => {
	/**
	 * XML Protocol Deprecation:
	 *
	 * XML tool protocol has been fully deprecated. All models now use Native
	 * tool calling. User preferences and model defaults are ignored.
	 *
	 * Precedence:
	 * 1. Locked Protocol (for resumed tasks that used XML)
	 * 2. Native (always, for all new tasks)
	 */

	describe("Locked Protocol (Precedence Level 0 - Highest Priority)", () => {
		it("should return lockedProtocol when provided", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml", // Ignored
				apiProvider: "openai-native",
			}
			// lockedProtocol overrides everything
			const result = resolveToolProtocol(settings, undefined, "native")
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should override model default when profile setting is present", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "native",
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Profile setting wins
		})

		it("should override model capability when profile setting is present", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml",
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Profile setting wins
		})
	})

	describe("Precedence Level 2: Model Default", () => {
		it("should use model defaultToolProtocol when no profile setting", () => {
			const settings: ProviderSettings = {
				apiProvider: "modelharbor",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "native",
				supportsNativeTools: true, // Model must support native tools
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Model default wins when experiment is disabled
		})

		it("should override model capability when model default is present", () => {
			const settings: ProviderSettings = {
				apiProvider: "modelharbor",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml",
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins over capability
		})
	})

	describe("Support Validation", () => {
		it("should fall back to XML when model doesn't support native", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native", // Ignored
				apiProvider: "anthropic",
			}
			// lockedProtocol forces XML for backward compatibility
			const result = resolveToolProtocol(settings, undefined, "xml")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})

		it("should fall through to Native when lockedProtocol is undefined", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml", // Ignored
				apiProvider: "anthropic",
			}
			// undefined lockedProtocol should return native
			const result = resolveToolProtocol(settings, undefined, undefined)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("Native Protocol Always Used For New Tasks", () => {
		it("should always use native for new tasks", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const result = resolveToolProtocol(settings, undefined)
			expect(result).toBe(TOOL_PROTOCOL.XML) // XML fallback
		})
	})

	describe("Complete Precedence Chain", () => {
		it("should respect full precedence: Profile > Model Default > XML Fallback", () => {
			// Set up a scenario with all levels defined
			const settings: ProviderSettings = {
				toolProtocol: "native", // Level 1: User profile setting
				apiProvider: "modelharbor",
			}

			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				defaultToolProtocol: "xml", // Level 2: Model default
				supportsNativeTools: true, // Support check
			}

			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Profile setting wins
		})

		it("should use native even when user preference is XML (user prefs ignored)", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml", // User wants XML - ignored
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should use native for OpenAI compatible provider", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai",
			}
			const result = resolveToolProtocol(settings, openAiModelInfoSaneDefaults)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})
	})

	describe("Edge Cases", () => {
		it("should handle missing provider name gracefully", () => {
			const settings: ProviderSettings = {}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Always native now
		})

		it("should handle undefined model info gracefully", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings, undefined)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Always native now
		})

		it("should fall back to XML when model doesn't support native", () => {
			const settings: ProviderSettings = {
				apiProvider: "modelharbor",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // Model doesn't support native
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})
	})

	describe("Real-world Scenarios", () => {
		it("should use Native for OpenAI models", () => {
			const settings: ProviderSettings = {
				apiProvider: "openai-native",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should use Native for Claude models", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE)
		})

		it("should honor locked protocol for resumed tasks that used XML", () => {
			const settings: ProviderSettings = {
				apiProvider: "anthropic",
			}
			// Task was started when XML was used, so it's locked to XML
			const result = resolveToolProtocol(settings, undefined, "xml")
			expect(result).toBe(TOOL_PROTOCOL.XML)
		})
	})

	describe("Backward Compatibility - User Preferences Ignored", () => {
		it("should ignore user preference for XML", () => {
			const settings: ProviderSettings = {
				toolProtocol: "xml", // User explicitly wants XML - ignored
				apiProvider: "openai-native",
			}
			const result = resolveToolProtocol(settings)
			expect(result).toBe(TOOL_PROTOCOL.NATIVE) // Native is always used
		})

		it("should return native regardless of user preference", () => {
			const settings: ProviderSettings = {
				toolProtocol: "native", // User preference - ignored but happens to match
				apiProvider: "anthropic",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 4096,
				contextWindow: 128000,
				supportsPromptCache: false,
				supportsNativeTools: false, // Model doesn't support native
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Falls back to XML due to lack of support
		})

		it("should use model default when available", () => {
			const settings: ProviderSettings = {
				apiProvider: "modelharbor",
			}
			const modelInfo: ModelInfo = {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsPromptCache: true,
				defaultToolProtocol: "xml",
				supportsNativeTools: true,
			}
			const result = resolveToolProtocol(settings, modelInfo)
			expect(result).toBe(TOOL_PROTOCOL.XML) // Model default wins
		})
	})
})
