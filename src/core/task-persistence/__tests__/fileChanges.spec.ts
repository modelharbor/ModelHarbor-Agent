import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { saveFileChanges, readFileChanges } from "../fileChanges"
import type { FileChange } from "@roo-code/types"
import path from "path"
import fs from "fs/promises"
import os from "os"

describe("fileChanges persistence", () => {
	let tmpDir: string

	beforeEach(async () => {
		tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "file-changes-test-"))
	})

	afterEach(async () => {
		await fs.rm(tmpDir, { recursive: true, force: true })
	})

	describe("saveFileChanges", () => {
		it("should save file changes to disk", async () => {
			const taskId = "test-task-123"
			const taskDir = path.join(tmpDir, "tasks", taskId)
			await fs.mkdir(taskDir, { recursive: true })

			const fileChanges: FileChange[] = [
				{
					path: "/src/foo.ts",
					originalContent: "old",
					updatedContent: "new",
					timestamp: 1000,
				},
			]

			await saveFileChanges({
				fileChanges,
				taskId,
				globalStoragePath: tmpDir,
			})

			const filePath = path.join(taskDir, "file_changes.json")
			const content = JSON.parse(await fs.readFile(filePath, "utf8"))
			expect(content).toEqual(fileChanges)
		})
	})

	describe("readFileChanges", () => {
		it("should return empty array when file does not exist", async () => {
			const result = await readFileChanges({
				taskId: "non-existent",
				globalStoragePath: tmpDir,
			})
			expect(result).toEqual([])
		})

		it("should read saved file changes from disk", async () => {
			const taskId = "test-task-456"
			const taskDir = path.join(tmpDir, "tasks", taskId)
			await fs.mkdir(taskDir, { recursive: true })

			const fileChanges: FileChange[] = [
				{
					path: "/src/bar.ts",
					originalContent: "before",
					updatedContent: "after",
					diff: "some diff",
					diffStats: { added: 1, removed: 1 },
					timestamp: 2000,
				},
			]

			await fs.writeFile(path.join(taskDir, "file_changes.json"), JSON.stringify(fileChanges))

			const result = await readFileChanges({
				taskId,
				globalStoragePath: tmpDir,
			})
			expect(result).toEqual(fileChanges)
		})
	})

	describe("round-trip", () => {
		it("should save and read back identical data", async () => {
			const taskId = "test-round-trip"
			const taskDir = path.join(tmpDir, "tasks", taskId)
			await fs.mkdir(taskDir, { recursive: true })

			const fileChanges: FileChange[] = [
				{
					path: "/src/a.ts",
					originalContent: "a-old",
					updatedContent: "a-new",
					isOutsideWorkspace: false,
					isProtected: false,
					timestamp: 1000,
				},
				{
					path: "/src/b.ts",
					originalContent: "b-old",
					updatedContent: "b-new",
					isOutsideWorkspace: true,
					isProtected: true,
					timestamp: 2000,
				},
			]

			await saveFileChanges({ fileChanges, taskId, globalStoragePath: tmpDir })
			const result = await readFileChanges({ taskId, globalStoragePath: tmpDir })
			expect(result).toEqual(fileChanges)
		})
	})
})
