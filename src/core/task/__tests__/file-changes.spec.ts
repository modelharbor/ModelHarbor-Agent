/**
 * Unit tests for Task file change tracking methods.
 *
 * Tests for:
 * - updateFileChange(): Updates or adds a file change record
 * - removeFileChange(): Removes a file change record
 * - getFileChanges(): Gets all file changes as an array
 * - clearFileChanges(): Clears all file changes
 * - mergeChildFileChanges(): Merges file changes from child subtask into parent
 * - Deduplication: Updating same file multiple times
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { Task } from "../Task"
import { ClineProvider } from "../../webview/ClineProvider"
import type { ProviderSettings } from "@roo-code/types"
import { saveFileChanges, readFileChanges } from "../../task-persistence"

// Mock dependencies
vi.mock("../../webview/ClineProvider")
vi.mock("../../../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		releaseTerminalsForTask: vi.fn(),
	},
}))
vi.mock("../../ignore/RooIgnoreController")
vi.mock("../../protect/RooProtectedController")
vi.mock("../../context-tracking/FileContextTracker")
vi.mock("../../../services/browser/UrlContentFetcher")
vi.mock("../../../services/browser/BrowserSession")
vi.mock("../../../integrations/editor/DiffViewProvider")
vi.mock("../../../api", () => ({
	buildApiHandler: vi.fn(() => ({
		getModel: () => ({ info: {}, id: "test-model" }),
	})),
}))

// Mock TelemetryService
vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureTaskCreated: vi.fn(),
			captureTaskRestarted: vi.fn(),
		},
	},
}))

// Mock task-persistence for file changes persistence
vi.mock("../../task-persistence", () => ({
	readApiMessages: vi.fn().mockResolvedValue([]),
	saveApiMessages: vi.fn().mockResolvedValue(undefined),
	readFileChanges: vi.fn().mockResolvedValue([]),
	saveFileChanges: vi.fn().mockResolvedValue(undefined),
	readTaskMessages: vi.fn().mockResolvedValue([]),
	saveTaskMessages: vi.fn().mockResolvedValue(undefined),
	taskMetadata: vi.fn().mockResolvedValue({ historyItem: {}, tokenUsage: {} }),
}))

describe("Task file change tracking", () => {
	let mockProvider: any
	let mockApiConfiguration: ProviderSettings
	let task: Task

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Mock provider
		mockProvider = {
			context: {
				globalStorageUri: { fsPath: "/test/path" },
			},
			getState: vi.fn().mockResolvedValue({ mode: "code" }),
			log: vi.fn(),
			postMessageToWebview: vi.fn(),
		}

		// Mock API configuration
		mockApiConfiguration = {
			apiProvider: "anthropic",
			apiKey: "test-key",
		} as ProviderSettings

		// Create task instance without starting it
		task = new Task({
			provider: mockProvider as ClineProvider,
			apiConfiguration: mockApiConfiguration,
			startTask: false,
		})
	})

	describe("updateFileChange", () => {
		test("should add a new file change", () => {
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original content",
				updatedContent: "updated content",
				diff: "--- a/src/test.ts\n+++ b/src/test.ts\n@@ -1 +1 @@\n-old\n+new",
				diffStats: { added: 1, removed: 1 },
			})

			const fileChanges = task.getFileChanges()
			expect(fileChanges).toHaveLength(1)
			expect(fileChanges[0]).toMatchObject({
				path: "src/test.ts",
				originalContent: "original content",
				updatedContent: "updated content",
				diff: "--- a/src/test.ts\n+++ b/src/test.ts\n@@ -1 +1 @@\n-old\n+new",
				diffStats: { added: 1, removed: 1 },
			})
		})

		test("should update existing file change preserving original content", () => {
			// First update
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original content",
				updatedContent: "first update",
				diff: "diff 1",
				diffStats: { added: 1, removed: 0 },
			})

			// Second update - should preserve original content
			task.updateFileChange({
				path: "src/test.ts",
				updatedContent: "second update",
				diff: "diff 2",
				diffStats: { added: 2, removed: 1 },
			})

			const fileChanges = task.getFileChanges()
			expect(fileChanges).toHaveLength(1)
			expect(fileChanges[0]).toMatchObject({
				path: "src/test.ts",
				originalContent: "original content", // Preserved from first update
				updatedContent: "second update",
				diff: "diff 2",
				diffStats: { added: 2, removed: 1 },
			})
		})

		test("should preserve timestamp on updates", () => {
			// First update
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "update 1",
			})

			const firstChange = task.getFileChanges()[0]
			const originalTimestamp = firstChange.timestamp

			// Second update
			task.updateFileChange({
				path: "src/test.ts",
				updatedContent: "update 2",
			})

			const secondChange = task.getFileChanges()[0]
			expect(secondChange.timestamp).toBe(originalTimestamp) // Timestamp preserved
		})

		test("should handle isOutsideWorkspace flag", () => {
			task.updateFileChange({
				path: "../outside/file.ts",
				originalContent: "original",
				updatedContent: "updated",
				isOutsideWorkspace: true,
			})

			const fileChanges = task.getFileChanges()
			expect(fileChanges[0].isOutsideWorkspace).toBe(true)
		})

		test("should handle isProtected flag", () => {
			task.updateFileChange({
				path: "protected/file.ts",
				originalContent: "original",
				updatedContent: "updated",
				isProtected: true,
			})

			const fileChanges = task.getFileChanges()
			expect(fileChanges[0].isProtected).toBe(true)
		})

		test("should merge flags on subsequent updates", () => {
			// First update without flags
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "update 1",
			})

			// Second update with flags
			task.updateFileChange({
				path: "src/test.ts",
				updatedContent: "update 2",
				isOutsideWorkspace: true,
				isProtected: true,
			})

			const fileChanges = task.getFileChanges()
			expect(fileChanges[0].isOutsideWorkspace).toBe(true)
			expect(fileChanges[0].isProtected).toBe(true)
		})

		test("should notify webview on update", () => {
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "updated",
			})

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "fileChanges",
					fileChanges: expect.any(Array),
				}),
			)
		})

		test("should handle minimal update with only path", () => {
			task.updateFileChange({
				path: "src/test.ts",
			})

			const fileChanges = task.getFileChanges()
			expect(fileChanges).toHaveLength(1)
			expect(fileChanges[0].path).toBe("src/test.ts")
			expect(fileChanges[0].originalContent).toBeUndefined()
			expect(fileChanges[0].updatedContent).toBeUndefined()
		})
	})

	describe("removeFileChange", () => {
		test("should remove existing file change", () => {
			// Add a file change
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "updated",
			})

			expect(task.getFileChanges()).toHaveLength(1)

			// Remove it
			task.removeFileChange("src/test.ts")

			expect(task.getFileChanges()).toHaveLength(0)
		})

		test("should notify webview on removal", () => {
			// Add a file change
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "updated",
			})

			// Clear mock to only check removal notification
			mockProvider.postMessageToWebview.mockClear()

			// Remove it
			task.removeFileChange("src/test.ts")

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "fileChanges",
					fileChanges: [],
				}),
			)
		})

		test("should not notify webview if file doesn't exist", () => {
			// Try to remove non-existent file
			task.removeFileChange("non-existent.ts")

			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		test("should handle removing from multiple files", () => {
			// Add multiple file changes
			task.updateFileChange({ path: "file1.ts", originalContent: "o1", updatedContent: "u1" })
			task.updateFileChange({ path: "file2.ts", originalContent: "o2", updatedContent: "u2" })
			task.updateFileChange({ path: "file3.ts", originalContent: "o3", updatedContent: "u3" })

			expect(task.getFileChanges()).toHaveLength(3)

			// Remove middle file
			task.removeFileChange("file2.ts")

			const remaining = task.getFileChanges()
			expect(remaining).toHaveLength(2)
			expect(remaining.map((f) => f.path)).toEqual(expect.arrayContaining(["file1.ts", "file3.ts"]))
		})
	})

	describe("getFileChanges", () => {
		test("should return empty array when no changes", () => {
			expect(task.getFileChanges()).toEqual([])
		})

		test("should return array of all file changes", () => {
			task.updateFileChange({ path: "file1.ts", originalContent: "o1", updatedContent: "u1" })
			task.updateFileChange({ path: "file2.ts", originalContent: "o2", updatedContent: "u2" })

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(2)
			expect(changes.map((c) => c.path)).toEqual(expect.arrayContaining(["file1.ts", "file2.ts"]))
		})

		test("should return FileChange objects with all properties", () => {
			const originalContent = "original content here"
			const updatedContent = "updated content here"
			const diff = "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@"
			const diffStats = { added: 5, removed: 3 }

			task.updateFileChange({
				path: "src/test.ts",
				originalContent,
				updatedContent,
				diff,
				diffStats,
				isOutsideWorkspace: true,
				isProtected: false,
			})

			const changes = task.getFileChanges()
			expect(changes[0]).toEqual({
				path: "src/test.ts",
				originalContent,
				updatedContent,
				diff,
				diffStats,
				isOutsideWorkspace: true,
				isProtected: false,
				timestamp: expect.any(Number),
			})
		})
	})

	describe("clearFileChanges", () => {
		test("should clear all file changes", () => {
			// Add multiple file changes
			task.updateFileChange({ path: "file1.ts", originalContent: "o1", updatedContent: "u1" })
			task.updateFileChange({ path: "file2.ts", originalContent: "o2", updatedContent: "u2" })
			task.updateFileChange({ path: "file3.ts", originalContent: "o3", updatedContent: "u3" })

			expect(task.getFileChanges()).toHaveLength(3)

			// Clear all
			task.clearFileChanges()

			expect(task.getFileChanges()).toHaveLength(0)
		})

		test("should notify webview on clear", () => {
			// Add a file change
			task.updateFileChange({ path: "file1.ts", originalContent: "o1", updatedContent: "u1" })

			// Clear mock to only check clear notification
			mockProvider.postMessageToWebview.mockClear()

			// Clear all
			task.clearFileChanges()

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "fileChanges",
					fileChanges: [],
				}),
			)
		})

		test("should notify webview even if already empty", () => {
			task.clearFileChanges()

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "fileChanges",
					fileChanges: [],
				}),
			)
		})
	})

	describe("deduplication", () => {
		test("should deduplicate updates to same file", () => {
			// Multiple updates to same file
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "v1",
				updatedContent: "v1-updated",
				diffStats: { added: 1, removed: 0 },
			})

			task.updateFileChange({
				path: "src/test.ts",
				updatedContent: "v2-updated",
				diffStats: { added: 2, removed: 1 },
			})

			task.updateFileChange({
				path: "src/test.ts",
				updatedContent: "v3-updated",
				diffStats: { added: 3, removed: 2 },
			})

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(1) // Only one entry
			expect(changes[0].path).toBe("src/test.ts")
			expect(changes[0].originalContent).toBe("v1") // First version preserved
			expect(changes[0].updatedContent).toBe("v3-updated") // Latest version
			expect(changes[0].diffStats).toEqual({ added: 3, removed: 2 }) // Latest stats
		})

		test("should track multiple different files separately", () => {
			// Update different files
			task.updateFileChange({ path: "file1.ts", originalContent: "o1", updatedContent: "u1" })
			task.updateFileChange({ path: "file2.ts", originalContent: "o2", updatedContent: "u2" })
			task.updateFileChange({ path: "file1.ts", updatedContent: "u1-v2" }) // Update file1 again
			task.updateFileChange({ path: "file3.ts", originalContent: "o3", updatedContent: "u3" })
			task.updateFileChange({ path: "file2.ts", updatedContent: "u2-v2" }) // Update file2 again

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(3) // Three unique files

			const file1 = changes.find((c) => c.path === "file1.ts")
			const file2 = changes.find((c) => c.path === "file2.ts")
			const file3 = changes.find((c) => c.path === "file3.ts")

			expect(file1?.updatedContent).toBe("u1-v2")
			expect(file1?.originalContent).toBe("o1")

			expect(file2?.updatedContent).toBe("u2-v2")
			expect(file2?.originalContent).toBe("o2")

			expect(file3?.updatedContent).toBe("u3")
			expect(file3?.originalContent).toBe("o3")
		})

		test("should preserve first timestamp across multiple updates", () => {
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "v1",
				updatedContent: "v1-updated",
			})

			const firstTimestamp = task.getFileChanges()[0].timestamp

			// Multiple updates
			task.updateFileChange({ path: "src/test.ts", updatedContent: "v2" })
			task.updateFileChange({ path: "src/test.ts", updatedContent: "v3" })
			task.updateFileChange({ path: "src/test.ts", updatedContent: "v4" })

			const changes = task.getFileChanges()
			expect(changes[0].timestamp).toBe(firstTimestamp)
		})
	})

	describe("mergeChildFileChanges", () => {
		test("should not change anything when given empty array", () => {
			task.mergeChildFileChanges([])

			expect(task.getFileChanges()).toEqual([])
			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		test("should not change anything when given undefined-like input", () => {
			task.mergeChildFileChanges(undefined as any)

			expect(task.getFileChanges()).toEqual([])
			expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
		})

		test("should add new file changes from child to parent", () => {
			const childChanges = [
				{
					path: "src/child-file1.ts",
					originalContent: "child-original-1",
					updatedContent: "child-updated-1",
					diff: "diff-1",
					diffStats: { added: 3, removed: 1 },
					timestamp: Date.now(),
				},
				{
					path: "src/child-file2.ts",
					originalContent: "child-original-2",
					updatedContent: "child-updated-2",
					diff: "diff-2",
					diffStats: { added: 5, removed: 2 },
					timestamp: Date.now(),
				},
			]

			task.mergeChildFileChanges(childChanges)

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(2)
			expect(changes.map((c) => c.path)).toEqual(
				expect.arrayContaining(["src/child-file1.ts", "src/child-file2.ts"]),
			)
			expect(changes.find((c) => c.path === "src/child-file1.ts")?.updatedContent).toBe("child-updated-1")
			expect(changes.find((c) => c.path === "src/child-file2.ts")?.updatedContent).toBe("child-updated-2")
		})

		test("should dedup overlapping paths: keep earliest originalContent, latest updatedContent", () => {
			// Parent already has a file change
			task.updateFileChange({
				path: "src/shared.ts",
				originalContent: "parent-original",
				updatedContent: "parent-updated",
				diff: "parent-diff",
				diffStats: { added: 1, removed: 0 },
			})

			mockProvider.postMessageToWebview.mockClear()

			// Child has change for same file
			const childChanges = [
				{
					path: "src/shared.ts",
					originalContent: "child-original",
					updatedContent: "child-updated",
					diff: "child-diff",
					diffStats: { added: 10, removed: 5 },
					timestamp: Date.now(),
				},
			]

			task.mergeChildFileChanges(childChanges)

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(1)

			const shared = changes[0]
			expect(shared.path).toBe("src/shared.ts")
			// Keep parent's earliest originalContent
			expect(shared.originalContent).toBe("parent-original")
			// Use child's latest updatedContent, diff, diffStats
			expect(shared.updatedContent).toBe("child-updated")
			expect(shared.diff).toBe("child-diff")
			expect(shared.diffStats).toEqual({ added: 10, removed: 5 })
		})

		test("should preserve earliest timestamp on overlapping paths", () => {
			// Parent has a file change with early timestamp
			task.updateFileChange({
				path: "src/shared.ts",
				originalContent: "parent-original",
				updatedContent: "parent-updated",
			})

			const parentTimestamp = task.getFileChanges()[0].timestamp!

			mockProvider.postMessageToWebview.mockClear()

			// Child has same file with later timestamp
			const childChanges = [
				{
					path: "src/shared.ts",
					originalContent: "child-original",
					updatedContent: "child-updated",
					timestamp: parentTimestamp + 10000,
				},
			]

			task.mergeChildFileChanges(childChanges)

			const changes = task.getFileChanges()
			expect(changes[0].timestamp).toBe(parentTimestamp)
		})

		test("should accumulate changes across multiple merges", () => {
			// First child merge
			task.mergeChildFileChanges([
				{
					path: "src/file-a.ts",
					originalContent: "orig-a",
					updatedContent: "updated-a",
					timestamp: Date.now(),
				},
			])

			expect(task.getFileChanges()).toHaveLength(1)

			// Second child merge
			task.mergeChildFileChanges([
				{
					path: "src/file-b.ts",
					originalContent: "orig-b",
					updatedContent: "updated-b",
					timestamp: Date.now(),
				},
			])

			expect(task.getFileChanges()).toHaveLength(2)

			// Third child merge — overlaps with file-a
			task.mergeChildFileChanges([
				{
					path: "src/file-a.ts",
					originalContent: "orig-a-v2",
					updatedContent: "updated-a-v3",
					timestamp: Date.now(),
				},
				{
					path: "src/file-c.ts",
					originalContent: "orig-c",
					updatedContent: "updated-c",
					timestamp: Date.now(),
				},
			])

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(3) // file-a, file-b, file-c

			const fileA = changes.find((c) => c.path === "src/file-a.ts")
			expect(fileA?.originalContent).toBe("orig-a") // Earliest preserved
			expect(fileA?.updatedContent).toBe("updated-a-v3") // Latest
		})

		test("should send single notification per merge call", () => {
			const childChanges = [
				{ path: "file1.ts", originalContent: "o1", updatedContent: "u1", timestamp: Date.now() },
				{ path: "file2.ts", originalContent: "o2", updatedContent: "u2", timestamp: Date.now() },
				{ path: "file3.ts", originalContent: "o3", updatedContent: "u3", timestamp: Date.now() },
			]

			task.mergeChildFileChanges(childChanges)

			// Should only notify once, not once per file
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledTimes(1)
			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "fileChanges",
					fileChanges: expect.arrayContaining([
						expect.objectContaining({ path: "file1.ts" }),
						expect.objectContaining({ path: "file2.ts" }),
						expect.objectContaining({ path: "file3.ts" }),
					]),
				}),
			)
		})

		test("should mix parent's existing changes with child's new and overlapping changes", () => {
			// Parent has two existing changes
			task.updateFileChange({ path: "parent-only.ts", originalContent: "po", updatedContent: "pu" })
			task.updateFileChange({ path: "shared.ts", originalContent: "so", updatedContent: "su" })

			mockProvider.postMessageToWebview.mockClear()

			// Child has one overlap + one new
			task.mergeChildFileChanges([
				{
					path: "shared.ts",
					originalContent: "child-so",
					updatedContent: "child-su",
					diff: "child-diff",
					diffStats: { added: 2, removed: 1 },
					timestamp: Date.now(),
				},
				{
					path: "child-only.ts",
					originalContent: "co",
					updatedContent: "cu",
					timestamp: Date.now(),
				},
			])

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(3)

			// Parent-only unchanged
			const parentOnly = changes.find((c) => c.path === "parent-only.ts")
			expect(parentOnly?.originalContent).toBe("po")
			expect(parentOnly?.updatedContent).toBe("pu")

			// Shared: parent's originalContent, child's updatedContent
			const shared = changes.find((c) => c.path === "shared.ts")
			expect(shared?.originalContent).toBe("so")
			expect(shared?.updatedContent).toBe("child-su")
			expect(shared?.diff).toBe("child-diff")

			// Child-only added
			const childOnly = changes.find((c) => c.path === "child-only.ts")
			expect(childOnly?.originalContent).toBe("co")
			expect(childOnly?.updatedContent).toBe("cu")
		})
	})

	describe("saveFileChangesToDisk", () => {
		test("should call saveFileChanges with correct parameters", async () => {
			const mockSave = vi.mocked(saveFileChanges)

			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "updated",
			})

			mockSave.mockClear()
			await task.saveFileChangesToDisk()

			expect(mockSave).toHaveBeenCalledWith({
				fileChanges: expect.arrayContaining([
					expect.objectContaining({
						path: "src/test.ts",
						originalContent: "original",
						updatedContent: "updated",
					}),
				]),
				taskId: task.taskId,
				globalStoragePath: "/test/path",
			})
		})

		test("should save empty array when no file changes", async () => {
			const mockSave = vi.mocked(saveFileChanges)
			mockSave.mockClear()

			await task.saveFileChangesToDisk()

			expect(mockSave).toHaveBeenCalledWith({
				fileChanges: [],
				taskId: task.taskId,
				globalStoragePath: "/test/path",
			})
		})

		test("should not throw on save failure", async () => {
			const mockSave = vi.mocked(saveFileChanges)
			mockSave.mockRejectedValueOnce(new Error("Disk full"))

			await expect(task.saveFileChangesToDisk()).resolves.not.toThrow()
		})

		test("should be called as fire-and-forget from updateFileChange", async () => {
			const mockSave = vi.mocked(saveFileChanges)
			mockSave.mockClear()

			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "updated",
			})

			// Allow fire-and-forget promise to settle
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockSave).toHaveBeenCalled()
		})

		test("should be called as fire-and-forget from mergeChildFileChanges", async () => {
			const mockSave = vi.mocked(saveFileChanges)
			mockSave.mockClear()

			task.mergeChildFileChanges([
				{
					path: "src/child.ts",
					originalContent: "co",
					updatedContent: "cu",
					timestamp: Date.now(),
				},
			])

			// Allow fire-and-forget promise to settle
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(mockSave).toHaveBeenCalled()
		})
	})

	describe("loadFileChangesFromDisk", () => {
		test("should populate fileChanges Map from disk", async () => {
			const mockRead = vi.mocked(readFileChanges)
			mockRead.mockResolvedValueOnce([
				{
					path: "src/file1.ts",
					originalContent: "o1",
					updatedContent: "u1",
					timestamp: 1000,
				},
				{
					path: "src/file2.ts",
					originalContent: "o2",
					updatedContent: "u2",
					timestamp: 2000,
				},
			])

			await task.loadFileChangesFromDisk()

			const changes = task.getFileChanges()
			expect(changes).toHaveLength(2)
			expect(changes.find((c) => c.path === "src/file1.ts")?.updatedContent).toBe("u1")
			expect(changes.find((c) => c.path === "src/file2.ts")?.updatedContent).toBe("u2")
		})

		test("should call readFileChanges with correct parameters", async () => {
			const mockRead = vi.mocked(readFileChanges)

			await task.loadFileChangesFromDisk()

			expect(mockRead).toHaveBeenCalledWith({
				taskId: task.taskId,
				globalStoragePath: "/test/path",
			})
		})

		test("should not throw on read failure", async () => {
			const mockRead = vi.mocked(readFileChanges)
			mockRead.mockRejectedValueOnce(new Error("File not found"))

			await expect(task.loadFileChangesFromDisk()).resolves.not.toThrow()
		})

		test("should leave existing changes when load fails", async () => {
			// Add a change first
			task.updateFileChange({
				path: "existing.ts",
				originalContent: "o",
				updatedContent: "u",
			})

			const mockRead = vi.mocked(readFileChanges)
			mockRead.mockRejectedValueOnce(new Error("Read error"))

			await task.loadFileChangesFromDisk()

			// Existing change should still be there
			expect(task.getFileChanges()).toHaveLength(1)
			expect(task.getFileChanges()[0].path).toBe("existing.ts")
		})

		test("should handle empty array from disk", async () => {
			const mockRead = vi.mocked(readFileChanges)
			mockRead.mockResolvedValueOnce([])

			await task.loadFileChangesFromDisk()

			expect(task.getFileChanges()).toHaveLength(0)
		})
	})

	describe("notifyFileChangesChanged", () => {
		test("should send file changes to webview", () => {
			task.updateFileChange({
				path: "src/test.ts",
				originalContent: "original",
				updatedContent: "updated",
				diffStats: { added: 1, removed: 1 },
			})

			expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
				type: "fileChanges",
				fileChanges: expect.arrayContaining([
					expect.objectContaining({
						path: "src/test.ts",
						diffStats: { added: 1, removed: 1 },
					}),
				]),
			})
		})

		test("should handle provider being garbage collected", () => {
			// Mock providerRef.deref() returning undefined
			const originalDeref = task.providerRef.deref
			task.providerRef.deref = vi.fn().mockReturnValue(undefined)

			// Should not throw
			expect(() => {
				task.updateFileChange({
					path: "src/test.ts",
					originalContent: "original",
					updatedContent: "updated",
				})
			}).not.toThrow()

			// Restore
			task.providerRef.deref = originalDeref
		})
	})
})
