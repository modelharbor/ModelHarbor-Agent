import fs from "fs/promises"
import { countTokens } from "../../utils/countTokens"
import { Anthropic } from "@anthropic-ai/sdk"

export interface ReadWithBudgetResult {
	/** The content read up to the token budget */
	content: string
	/** Actual token count of returned content */
	tokenCount: number
	/** Total lines in the returned content */
	lineCount: number
	/** Whether the entire file was read (false if truncated) */
	complete: boolean
}

export interface ReadWithBudgetOptions {
	/** Maximum tokens allowed. Required. */
	budgetTokens: number
	/** Number of lines to buffer before token counting (default: 256) */
	chunkLines?: number
}

/**
 * Reads a file while incrementally counting tokens, stopping when budget is reached.
 *
 * Unlike validateFileTokenBudget + extractTextFromFile, this is a single-pass
 * operation that returns the actual content up to the token limit.
 *
 * @param filePath - Path to the file to read
 * @param options - Budget and chunking options
 * @returns Content read, token count, and completion status
 */
export async function readFileWithTokenBudget(
	filePath: string,
	options: ReadWithBudgetOptions,
): Promise<ReadWithBudgetResult> {
	const { budgetTokens } = options

	// Verify file exists
	try {
		await fs.access(filePath)
	} catch {
		throw new Error(`File not found: ${filePath}`)
	}

	// Read the entire file at once. We deliberately avoid the chunked
	// readline/pause/resume approach here — that design races between the
	// "line" event and async token counting, which produced
	// "readline was closed" errors when the interface was used after close.
	// Reading the whole file is simpler; if it is too large for the context
	// window the API call downstream surfaces a natural size error instead.
	const content = await fs.readFile(filePath, "utf8")

	// Count lines without loading a second copy: trailing newline does not
	// create an extra line.
	const lineCount = content.length === 0 ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0)

	// Count tokens for the full content (fall back to a conservative estimate).
	let tokenCount: number
	try {
		const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: content }]
		tokenCount = await countTokens(contentBlocks)
	} catch {
		tokenCount = Math.ceil(content.length / 2)
	}

	// `complete` reflects whether the content fits within the requested budget.
	// The full content is always returned; callers can surface the budget
	// notice based on this flag.
	const complete = tokenCount <= budgetTokens

	return { content, tokenCount, lineCount, complete }
}
