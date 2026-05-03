import * as path from "path"
import * as fs from "fs/promises"
import { statfs as statfsCb } from "fs"
import getFolderSize from "get-folder-size"

/**
 * Get disk space information for the filesystem containing the given path.
 * Uses Node.js fs.statfs (available since Node 18.15+).
 * Falls back to zeros if the call fails.
 */
async function getDiskInfo(dirPath: string): Promise<{
	diskTotal: number
	diskUsed: number
	diskAvailable: number
}> {
	return new Promise((resolve) => {
		statfsCb(dirPath, (err, stats) => {
			if (err) {
				resolve({ diskTotal: 0, diskUsed: 0, diskAvailable: 0 })
				return
			}
			const blockSize = stats.bsize
			const diskTotal = blockSize * stats.blocks
			const diskAvailable = blockSize * stats.bavail
			const diskUsed = diskTotal - blockSize * stats.bfree
			resolve({ diskTotal, diskUsed, diskAvailable })
		})
	})
}

/**
 * Count the number of directories inside a given directory.
 * Returns 0 if the directory does not exist or on error.
 */
async function countDirectories(dirPath: string): Promise<number> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		return entries.filter((entry) => entry.isDirectory()).length
	} catch {
		return 0
	}
}

/**
 * Safely get folder size using get-folder-size library.
 * Returns 0 if the directory does not exist or on error.
 */
async function safeGetFolderSize(dirPath: string): Promise<number> {
	try {
		return await getFolderSize.loose(dirPath)
	} catch {
		return 0
	}
}

/**
 * Calculate cache info - sizes of tasks, checkpoints, and cache directories.
 *
 * @param basePath - The base storage path (from getStorageBasePath)
 * @returns Object with size/count information and disk space info
 */
export async function calculateCacheInfo(basePath: string): Promise<{
	tasksSize: number
	tasksCount: number
	checkpointsSize: number
	checkpointsCount: number
	cacheSize: number
	totalSize: number
	diskTotal: number
	diskUsed: number
	diskAvailable: number
}> {
	const tasksPath = path.join(basePath, "tasks")
	const checkpointsPath = path.join(basePath, "checkpoints")
	const cachePath = path.join(basePath, "cache")

	// Calculate sizes, counts, and disk info in parallel
	const [tasksSize, tasksCount, checkpointsSize, checkpointsCount, cacheSize, diskInfo] = await Promise.all([
		safeGetFolderSize(tasksPath),
		countDirectories(tasksPath),
		safeGetFolderSize(checkpointsPath),
		countDirectories(checkpointsPath),
		safeGetFolderSize(cachePath),
		getDiskInfo(basePath),
	])

	const totalSize = tasksSize + checkpointsSize + cacheSize

	return {
		tasksSize,
		tasksCount,
		checkpointsSize,
		checkpointsCount,
		cacheSize,
		totalSize,
		...diskInfo,
	}
}

/**
 * Clear all cache - deletes tasks, checkpoints, and cache directories.
 *
 * @param basePath - The base storage path (from getStorageBasePath)
 * @returns Object with deletion counts and total freed bytes
 */
export async function clearAllCache(basePath: string): Promise<{
	tasksDeleted: number
	checkpointsDeleted: number
	cacheCleared: boolean
	freedBytes: number
}> {
	const tasksPath = path.join(basePath, "tasks")
	const checkpointsPath = path.join(basePath, "checkpoints")
	const cachePath = path.join(basePath, "cache")

	// Get sizes before deletion to calculate freed bytes
	const [tasksSize, checkpointsSize, cacheSize] = await Promise.all([
		safeGetFolderSize(tasksPath),
		safeGetFolderSize(checkpointsPath),
		safeGetFolderSize(cachePath),
	])

	// Count items before deletion
	const [tasksCount, checkpointsCount] = await Promise.all([
		countDirectories(tasksPath),
		countDirectories(checkpointsPath),
	])

	// Delete directories (force: true prevents errors if directory doesn't exist)
	const results = await Promise.allSettled([
		fs.rm(tasksPath, { recursive: true, force: true }),
		fs.rm(checkpointsPath, { recursive: true, force: true }),
		fs.rm(cachePath, { recursive: true, force: true }),
	])

	const cacheCleared = results.every((r) => r.status === "fulfilled")

	return {
		tasksDeleted: tasksCount,
		checkpointsDeleted: checkpointsCount,
		cacheCleared,
		freedBytes: tasksSize + checkpointsSize + cacheSize,
	}
}

/**
 * Calculate the total size of a directory in bytes.
 * Returns 0 if the directory does not exist or on error.
 */
export async function calculateDirectorySize(dirPath: string): Promise<number> {
	return safeGetFolderSize(dirPath)
}

/**
 * Format bytes to human readable string (B, KB, MB, GB, etc.)
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"

	const units = ["B", "KB", "MB", "GB", "TB", "PB"]
	const k = 1024
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	const value = bytes / Math.pow(k, i)

	// Format to 2 decimal places, removing trailing zeros
	return `${parseFloat(value.toFixed(2))} ${units[i]}`
}
