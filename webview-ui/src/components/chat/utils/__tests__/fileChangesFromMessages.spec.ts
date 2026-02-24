import type { ClineMessage } from "@roo-code/types"
import { fileChangesFromMessages, fileChangesFromMessagesAsFileChange } from "../fileChangesFromMessages"

/**
 * Helper to create a tool approval message
 */
function createToolMessage(overrides: Partial<ClineMessage> & { toolData: any }): ClineMessage {
	return {
		type: "ask",
		ask: "tool",
		ts: Date.now(),
		partial: false,
		isAnswered: true,
		text: JSON.stringify(overrides.toolData),
		...overrides,
	}
}

describe("fileChangesFromMessages", () => {
	describe("empty/edge cases", () => {
		it("returns empty array for undefined messages", () => {
			expect(fileChangesFromMessages(undefined)).toEqual([])
		})

		it("returns empty array for empty messages array", () => {
			expect(fileChangesFromMessages([])).toEqual([])
		})

		it("returns empty array for messages without tool edits", () => {
			const messages: ClineMessage[] = [
				{ type: "say", say: "text", ts: Date.now(), text: "Hello" },
				{ type: "say", say: "text", ts: Date.now(), text: "World" },
			]
			expect(fileChangesFromMessages(messages)).toEqual([])
		})

		it("filters out partial messages", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					partial: true,
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "+new line",
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]
			expect(fileChangesFromMessages(messages)).toEqual([])
		})

		it("filters out unanswered (unapproved) messages", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					isAnswered: false,
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "+new line",
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]
			expect(fileChangesFromMessages(messages)).toEqual([])
		})

		it("filters out messages without text", () => {
			const messages: ClineMessage[] = [
				{ type: "ask", ask: "tool", ts: Date.now(), partial: false, isAnswered: true },
			]
			expect(fileChangesFromMessages(messages)).toEqual([])
		})

		it("filters out messages with invalid JSON", () => {
			const messages: ClineMessage[] = [
				{
					type: "ask",
					ask: "tool",
					ts: Date.now(),
					partial: false,
					isAnswered: true,
					text: "invalid-json",
				},
			]
			expect(fileChangesFromMessages(messages)).toEqual([])
		})
	})

	describe("editedExistingFile tool", () => {
		it("extracts file change from editedExistingFile message", () => {
			const diff = "@@ -1,1 +1,1 @@\n-old\n+new\n"
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff,
						diffStats: { added: 1, removed: 1 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/file.ts",
				diff,
				diffStats: { added: 1, removed: 1 },
			})
		})

		it("extracts file change with content fallback when diff is missing", () => {
			const content = "new content"
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						content,
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/file.ts",
				diff: content,
				diffStats: { added: 1, removed: 0 },
			})
		})

		it("skips editedExistingFile without path", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						diff: "+new line",
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]

			expect(fileChangesFromMessages(messages)).toEqual([])
		})

		it("skips editedExistingFile without diff or content", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
					},
				}),
			]

			expect(fileChangesFromMessages(messages)).toEqual([])
		})
	})

	describe("appliedDiff tool", () => {
		it("extracts file change from appliedDiff message", () => {
			const diff = "@@ -1,0 +1,2 @@\n+line1\n+line2\n"
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "appliedDiff",
						path: "src/utils.ts",
						diff,
						diffStats: { added: 2, removed: 0 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/utils.ts",
				diff,
				diffStats: { added: 2, removed: 0 },
			})
		})
	})

	describe("newFileCreated tool", () => {
		it("extracts file change from newFileCreated message with content", () => {
			const content = "export const hello = 'world'"
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "newFileCreated",
						path: "src/hello.ts",
						content,
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/hello.ts",
				diff: content,
				diffStats: { added: 1, removed: 0 },
			})
		})

		it("extracts file change from newFileCreated with diff", () => {
			const diff = "--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1 @@\n+content\n"
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "newFileCreated",
						path: "src/new.ts",
						diff,
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/new.ts",
				diff,
				diffStats: { added: 1, removed: 0 },
			})
		})
	})

	describe("batchDiffs", () => {
		it("extracts multiple file changes from batchDiffs", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						batchDiffs: [
							{
								path: "src/file1.ts",
								content: "content1",
								diffStats: { added: 2, removed: 1 },
							},
							{
								path: "src/file2.ts",
								content: "content2",
								diffStats: { added: 1, removed: 2 },
							},
						],
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(2)
			expect(result[0]).toMatchObject({
				path: "src/file1.ts",
				diff: "content1",
				diffStats: { added: 2, removed: 1 },
			})
			expect(result[1]).toMatchObject({
				path: "src/file2.ts",
				diff: "content2",
				diffStats: { added: 1, removed: 2 },
			})
		})

		it("handles batchDiffs with diffs array instead of content", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						batchDiffs: [
							{
								path: "src/file.ts",
								diffs: [{ content: "diff1" }, { content: "diff2" }],
								diffStats: { added: 2, removed: 0 },
							},
						],
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/file.ts",
				diff: "diff1\ndiff2",
				diffStats: { added: 2, removed: 0 },
			})
		})

		it("skips batchDiff entries without path", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						batchDiffs: [
							{ path: "src/file1.ts", content: "content1" },
							{ content: "content2" }, // no path
						],
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0].path).toBe("src/file1.ts")
		})

		it("skips batchDiff entries without content or diffs", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						batchDiffs: [
							{ path: "src/file1.ts", content: "content1" },
							{ path: "src/file2.ts" }, // no content or diffs
						],
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0].path).toBe("src/file1.ts")
		})
	})

	describe("deduplication", () => {
		it("keeps only the latest change for each file path", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "first diff",
						diffStats: { added: 1, removed: 0 },
					},
				}),
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "second diff",
						diffStats: { added: 2, removed: 1 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/file.ts",
				diff: "second diff",
				diffStats: { added: 2, removed: 1 },
			})
		})

		it("keeps separate entries for different file paths", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file1.ts",
						diff: "diff1",
						diffStats: { added: 1, removed: 0 },
					},
				}),
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file2.ts",
						diff: "diff2",
						diffStats: { added: 2, removed: 0 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(2)
			expect(result.map((r) => r.path)).toEqual(["src/file1.ts", "src/file2.ts"])
		})
	})

	describe("mixed message types", () => {
		it("extracts only file edit tools from mixed messages", () => {
			const messages: ClineMessage[] = [
				{ type: "say", say: "text", ts: Date.now(), text: "Hello" },
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "diff",
						diffStats: { added: 1, removed: 0 },
					},
				}),
				{ type: "say", say: "text", ts: Date.now(), text: "World" },
				createToolMessage({
					toolData: {
						tool: "newFileCreated",
						path: "src/new.ts",
						content: "content",
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(2)
			expect(result.map((r) => r.path)).toEqual(["src/file.ts", "src/new.ts"])
		})

		it("filters out non-file-edit tools", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "readFile",
						path: "src/file.ts",
					},
				}),
				createToolMessage({
					toolData: {
						tool: "runCommand",
						command: "npm test",
					},
				}),
			]

			expect(fileChangesFromMessages(messages)).toEqual([])
		})
	})

	describe("originalContent", () => {
		it("includes originalContent when present", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "diff",
						diffStats: { added: 1, removed: 1 },
						originalContent: "original content",
					},
				}),
			]

			const result = fileChangesFromMessages(messages)

			expect(result).toHaveLength(1)
			expect(result[0].originalContent).toBe("original content")
		})
	})
})

describe("fileChangesFromMessagesAsFileChange", () => {
	describe("empty/edge cases", () => {
		it("returns empty array for undefined messages", () => {
			expect(fileChangesFromMessagesAsFileChange(undefined)).toEqual([])
		})

		it("returns empty array for empty messages array", () => {
			expect(fileChangesFromMessagesAsFileChange([])).toEqual([])
		})

		it("filters out partial messages", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					partial: true,
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "+new line",
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]
			expect(fileChangesFromMessagesAsFileChange(messages)).toEqual([])
		})

		it("filters out unanswered (unapproved) messages", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					isAnswered: false,
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "+new line",
						diffStats: { added: 1, removed: 0 },
					},
				}),
			]
			expect(fileChangesFromMessagesAsFileChange(messages)).toEqual([])
		})
	})

	describe("editedExistingFile tool", () => {
		it("extracts file change with updatedContent from editedExistingFile", () => {
			const diff = "@@ -1,1 +1,1 @@\n-old\n+new\n"
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff,
						diffStats: { added: 1, removed: 1 },
					},
				}),
			]

			const result = fileChangesFromMessagesAsFileChange(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/file.ts",
				updatedContent: diff,
				diff,
				diffStats: { added: 1, removed: 1 },
			})
		})

		it("includes isOutsideWorkspace and isProtected flags", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "/outside/file.ts",
						diff: "diff",
						isOutsideWorkspace: true,
						isProtected: true,
					},
				}),
			]

			const result = fileChangesFromMessagesAsFileChange(messages)

			expect(result).toHaveLength(1)
			expect(result[0].isOutsideWorkspace).toBe(true)
			expect(result[0].isProtected).toBe(true)
		})
	})

	describe("batchDiffs", () => {
		it("extracts multiple file changes with updatedContent", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						batchDiffs: [
							{
								path: "src/file1.ts",
								content: "content1",
								diffStats: { added: 2, removed: 1 },
							},
							{
								path: "src/file2.ts",
								content: "content2",
								diffStats: { added: 1, removed: 2 },
							},
						],
					},
				}),
			]

			const result = fileChangesFromMessagesAsFileChange(messages)

			expect(result).toHaveLength(2)
			expect(result[0]).toMatchObject({
				path: "src/file1.ts",
				updatedContent: "content1",
				diff: "content1",
				diffStats: { added: 2, removed: 1 },
			})
			expect(result[1]).toMatchObject({
				path: "src/file2.ts",
				updatedContent: "content2",
				diff: "content2",
				diffStats: { added: 1, removed: 2 },
			})
		})
	})

	describe("deduplication", () => {
		it("keeps only the latest change for each file path", () => {
			const messages: ClineMessage[] = [
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "first diff",
						diffStats: { added: 1, removed: 0 },
					},
				}),
				createToolMessage({
					toolData: {
						tool: "editedExistingFile",
						path: "src/file.ts",
						diff: "second diff",
						diffStats: { added: 2, removed: 1 },
					},
				}),
			]

			const result = fileChangesFromMessagesAsFileChange(messages)

			expect(result).toHaveLength(1)
			expect(result[0]).toMatchObject({
				path: "src/file.ts",
				updatedContent: "second diff",
				diff: "second diff",
				diffStats: { added: 2, removed: 1 },
			})
		})
	})
})
