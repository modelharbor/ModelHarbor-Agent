import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readFileChanges, saveFileChanges } from "../core/task-persistence/fileChanges"
import type { FileChange } from "@roo-code/types"
import path from "path"
import fs from "fs/promises"
import os from "os"

describe("fileChanges persistence integration", () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fc-integration-"))
	})

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	it("should survive save → read round-trip simulating delegation lifecycle", async () => {
		const parentTaskId = "parent-task"
		const childTaskId = "child-task"
		const parentDir = path.join(tmpDir, "tasks", parentTaskId)
		const childDir = path.join(tmpDir, "tasks", childTaskId)
		await fs.mkdir(parentDir, { recursive: true })
		await fs.mkdir(childDir, { recursive: true })

		// 1. Parent has existing file changes
		const parentChanges: FileChange[] = [
			{
				path: "/src/existing.ts",
				originalContent: "original",
				updatedContent: "modified-by-parent",
				timestamp: 1000,
			},
		]
		await saveFileChanges({ fileChanges: parentChanges, taskId: parentTaskId, globalStoragePath: tmpDir })

		// 2. Child makes additional changes
		const childChanges: FileChange[] = [
			{
				path: "/src/new-file.ts",
				originalContent: "",
				updatedContent: "created-by-child",
				timestamp: 2000,
			},
			{
				path: "/src/existing.ts",
				originalContent: "original",
				updatedContent: "modified-by-child",
				timestamp: 3000,
			},
		]
		await saveFileChanges({ fileChanges: childChanges, taskId: childTaskId, globalStoragePath: tmpDir })

		// 3. Parent is restored and loads its persisted changes
		const restoredParentChanges = await readFileChanges({ taskId: parentTaskId, globalStoragePath: tmpDir })
		expect(restoredParentChanges).toHaveLength(1)
		expect(restoredParentChanges[0].path).toBe("/src/existing.ts")

		// 4. Child changes are read
		const restoredChildChanges = await readFileChanges({ taskId: childTaskId, globalStoragePath: tmpDir })
		expect(restoredChildChanges).toHaveLength(2)

		// 5. Simulate merge: parent gets child changes merged
		const mergedMap = new Map<string, FileChange>()
		for (const change of restoredParentChanges) {
			mergedMap.set(change.path, change)
		}
		for (const childChange of restoredChildChanges) {
			const existing = mergedMap.get(childChange.path)
			if (existing) {
				existing.updatedContent = childChange.updatedContent
				existing.diff = childChange.diff
				existing.diffStats = childChange.diffStats
			} else {
				mergedMap.set(childChange.path, { ...childChange })
			}
		}

		// 6. Verify merged result
		const mergedChanges = Array.from(mergedMap.values())
		expect(mergedChanges).toHaveLength(2)

		const existingFile = mergedChanges.find((c) => c.path === "/src/existing.ts")
		expect(existingFile?.updatedContent).toBe("modified-by-child") // child's version wins
		expect(existingFile?.originalContent).toBe("original") // original preserved

		const newFile = mergedChanges.find((c) => c.path === "/src/new-file.ts")
		expect(newFile?.updatedContent).toBe("created-by-child")

		// 7. Save merged result back
		await saveFileChanges({
			fileChanges: mergedChanges,
			taskId: parentTaskId,
			globalStoragePath: tmpDir,
		})

		// 8. Verify final persistence
		const finalChanges = await readFileChanges({ taskId: parentTaskId, globalStoragePath: tmpDir })
		expect(finalChanges).toHaveLength(2)
	})

	it("should handle empty file changes gracefully", async () => {
		const taskId = "empty-task"
		const taskDir = path.join(tmpDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		// Save empty changes
		await saveFileChanges({ fileChanges: [], taskId, globalStoragePath: tmpDir })

		// Read back
		const result = await readFileChanges({ taskId, globalStoragePath: tmpDir })
		expect(result).toEqual([])
	})

	it("should return empty array for task with no file_changes.json", async () => {
		const taskId = "no-file-task"
		const taskDir = path.join(tmpDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		const result = await readFileChanges({ taskId, globalStoragePath: tmpDir })
		expect(result).toEqual([])
	})

	it("should overwrite previous file changes on save", async () => {
		const taskId = "overwrite-task"
		const taskDir = path.join(tmpDir, "tasks", taskId)
		await fs.mkdir(taskDir, { recursive: true })

		// Save initial changes
		const initial: FileChange[] = [{ path: "/a.ts", originalContent: "a", updatedContent: "a2", timestamp: 1000 }]
		await saveFileChanges({ fileChanges: initial, taskId, globalStoragePath: tmpDir })

		// Save updated changes (replaces, not appends)
		const updated: FileChange[] = [
			{ path: "/a.ts", originalContent: "a", updatedContent: "a3", timestamp: 2000 },
			{ path: "/b.ts", originalContent: "b", updatedContent: "b2", timestamp: 2000 },
		]
		await saveFileChanges({ fileChanges: updated, taskId, globalStoragePath: tmpDir })

		const result = await readFileChanges({ taskId, globalStoragePath: tmpDir })
		expect(result).toHaveLength(2)
		expect(result[0].updatedContent).toBe("a3")
		expect(result[1].path).toBe("/b.ts")
	})
})
