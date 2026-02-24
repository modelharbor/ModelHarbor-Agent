import { ToolProtocol, TOOL_PROTOCOL } from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"
import type { ApiHandlerOptions } from "../shared/api"
import type { Anthropic } from "@anthropic-ai/sdk"
import { findLast, findLastIndex } from "../shared/array"

/**
 * Represents an API message in the conversation history.
 * This is a minimal type definition for the detection function.
 */
type ApiMessageForDetection = Anthropic.MessageParam & {
	ts?: number
}

/**
 * Check if ModelHarbor model supports native tools based on model name patterns.
 * Models that support native tools return tool calls in delta.tool_calls (OpenAI format).
 * Models that don't support native tools return tool calls as XML text in the content.
 *
 * Models supporting native tools: haiku
 * Models returning XML tool calls: all other models (anthropic, qwen, glm, gpt, deepseek, etc.)
 *
 * @param modelId - The model ID to check
 * @returns true if the model supports native tools, false otherwise
 */
function supportsNativeToolsByModelName(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase()
	return (
		lowerModelId.includes("qwen") ||
		lowerModelId.includes("glm") ||
		lowerModelId.includes("gpt") ||
		lowerModelId.includes("deepseek")
	)
}

/**
 * Resolve the effective tool protocol.
 *
 * **ModelHarbor and LiteLLM Special Case:**
 * These providers use a hybrid approach depending on the backend model:
 * - Models supporting native tools (haiku) return tool_calls in delta
 * - Other models (anthropic, qwen, glm, gpt, deepseek, etc.) return tool calls as XML text in content
 *
 * For models that return XML tool calls, we must use XML protocol to parse them.
 *
 * **Deprecation Note (XML Protocol):**
 * XML tool protocol has been deprecated for most providers. All models now use Native tool calling.
 * User/profile preferences (`providerSettings.toolProtocol`) and model defaults
 * (`modelInfo.defaultToolProtocol`) are ignored.
 *
 * Precedence:
 * 1. Locked Protocol (task-level lock for resumed tasks - highest priority)
 * 2. ModelHarbor/LiteLLM with non-native-tool model -> XML
 * 3. Native (always, for all other new tasks)
 *
 * @param providerSettings - The provider settings (used to identify ModelHarbor/LiteLLM)
 * @param _modelInfo - Unused, kept for API compatibility
 * @param lockedProtocol - Optional task-locked protocol that takes absolute precedence
 * @returns The resolved tool protocol (either "xml" or "native")
 */
export function resolveToolProtocol(
	providerSettings: ProviderSettings,
	_modelInfo?: unknown,
	lockedProtocol?: ToolProtocol,
): ToolProtocol {
	// 1. Locked Protocol - task-level lock takes absolute precedence
	// This ensures resumed tasks continue using their original protocol
	if (lockedProtocol) {
		return lockedProtocol
	}

	// 2. Special case for ModelHarbor and LiteLLM: use XML protocol for models that don't support native tools
	if (providerSettings?.apiProvider === "modelharbor" || providerSettings?.apiProvider === "litellm") {
		const apiHandlerOptions = providerSettings as ApiHandlerOptions

		// Get the model ID - check both possible field names for each provider
		let modelId = ""
		if (providerSettings.apiProvider === "modelharbor") {
			modelId = (apiHandlerOptions as any).modelharborModelId || ""
		} else if (providerSettings.apiProvider === "litellm") {
			modelId = (apiHandlerOptions as any).litellmModelId || ""
		}

		// If the model doesn't support native tools, use XML protocol
		// This allows the XML parser to extract tool calls from text content
		if (modelId && !supportsNativeToolsByModelName(modelId)) {
			return TOOL_PROTOCOL.XML
		}
	}

	// 3. Always return Native protocol for new tasks
	// All models now support native tools; XML is deprecated
	return TOOL_PROTOCOL.NATIVE
}

/**
 * Detect the tool protocol used in an existing conversation history.
 *
 * This function scans the API conversation history for tool_use blocks
 * and determines which protocol was used based on their structure:
 *
 * - Native protocol: tool_use blocks ALWAYS have an `id` field
 * - XML protocol: tool_use blocks NEVER have an `id` field
 *
 * This is critical for task resumption: if a task previously used tools
 * with a specific protocol, we must continue using that protocol even
 * if the user's NTC settings have changed.
 *
 * The function searches from the most recent message backwards to find
 * the last tool call, which represents the task's current protocol state.
 *
 * @param messages - The API conversation history to scan
 * @returns The detected protocol, or undefined if no tool calls were found
 */
export function detectToolProtocolFromHistory(messages: ApiMessageForDetection[]): ToolProtocol | undefined {
	// Find the last assistant message that contains a tool_use block
	const lastAssistantWithTool = findLast(messages, (message) => {
		if (message.role !== "assistant") {
			return false
		}
		const content = message.content
		if (!Array.isArray(content)) {
			return false
		}
		return content.some((block) => block.type === "tool_use")
	})

	if (!lastAssistantWithTool) {
		return undefined
	}

	// Find the last tool_use block in that message's content
	const content = lastAssistantWithTool.content as Anthropic.ContentBlock[]
	const lastToolUseIndex = findLastIndex(content, (block) => block.type === "tool_use")

	if (lastToolUseIndex === -1) {
		return undefined
	}

	const lastToolUse = content[lastToolUseIndex]

	// The presence or absence of `id` determines the protocol:
	// - Native protocol tool calls ALWAYS have an ID (set when parsed from tool_call chunks)
	// - XML protocol tool calls NEVER have an ID (parsed from XML text)
	// This pattern is used in presentAssistantMessage.ts:497-500
	const hasId = "id" in lastToolUse && !!lastToolUse.id
	return hasId ? TOOL_PROTOCOL.NATIVE : TOOL_PROTOCOL.XML
}
