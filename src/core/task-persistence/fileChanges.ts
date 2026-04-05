import * as path from "path"
import fs from "fs/promises"

import type { FileChange } from "@roo-code/types"

import { GlobalFileNames } from "../../shared/globalFileNames"
import { getTaskDirectoryPath } from "../../utils/storage"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"

interface FileChangesParams {
	taskId: string
	globalStoragePath: string
}

interface SaveFileChangesParams extends FileChangesParams {
	fileChanges: FileChange[]
}

export async function saveFileChanges({
	fileChanges,
	taskId,
	globalStoragePath,
}: SaveFileChangesParams): Promise<void> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.fileChanges)
	await safeWriteJson(filePath, fileChanges)
}

export async function readFileChanges({ taskId, globalStoragePath }: FileChangesParams): Promise<FileChange[]> {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, taskId)
	const filePath = path.join(taskDir, GlobalFileNames.fileChanges)

	if (await fileExistsAtPath(filePath)) {
		const fileContent = await fs.readFile(filePath, "utf8")
		return JSON.parse(fileContent)
	}

	return []
}
