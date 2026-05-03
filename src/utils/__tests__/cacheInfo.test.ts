import * as fsPromises from "fs/promises"

// Mock fs/promises with readdir and rm added
vi.mock("fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("fs/promises")>()
	return {
		...actual,
		readdir: vi.fn(),
		rm: vi.fn(),
	}
})

// Mock the 'fs' module to control statfs
vi.mock("fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("fs")>()
	return {
		...actual,
		statfs: vi.fn(),
	}
})

// Mock get-folder-size
vi.mock("get-folder-size", () => ({
	default: {
		loose: vi.fn(),
	},
}))

import * as fs from "fs"
import getFolderSize from "get-folder-size"
import { formatBytes, calculateCacheInfo, clearAllCache, calculateDirectorySize } from "../cacheInfo"

/**
 * Helper to set up statfs mock to return specific disk stats.
 */
function setupStatfs(stats: { bsize: number; blocks: number; bavail: number; bfree: number } | null) {
	const mockStatfs = fs.statfs as unknown as ReturnType<typeof vi.fn>
	if (stats) {
		mockStatfs.mockImplementation((_path: string, cb: (err: Error | null, stats: unknown) => void) => {
			cb(null, stats)
		})
	} else {
		mockStatfs.mockImplementation((_path: string, cb: (err: Error | null, stats: unknown) => void) => {
			cb(new Error("statfs error"), undefined)
		})
	}
}

describe("formatBytes", () => {
	it("returns '0 B' for 0", () => {
		expect(formatBytes(0)).toBe("0 B")
	})

	it("returns correct format for bytes (e.g., '512 B')", () => {
		expect(formatBytes(512)).toBe("512 B")
	})

	it("returns correct format for bytes at boundary (1023 B)", () => {
		expect(formatBytes(1023)).toBe("1023 B")
	})

	it("returns correct format for KB (e.g., '1.5 KB')", () => {
		expect(formatBytes(1536)).toBe("1.5 KB")
	})

	it("returns correct format for exactly 1 KB", () => {
		expect(formatBytes(1024)).toBe("1 KB")
	})

	it("returns correct format for 100 MB", () => {
		expect(formatBytes(100 * 1024 * 1024)).toBe("100 MB")
	})

	it("returns correct format for 2.5 GB", () => {
		expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB")
	})

	it("returns correct format for TB", () => {
		expect(formatBytes(1.5 * 1024 * 1024 * 1024 * 1024)).toBe("1.5 TB")
	})

	it("returns correct format for PB", () => {
		expect(formatBytes(1.2 * 1024 * 1024 * 1024 * 1024 * 1024)).toBe("1.2 PB")
	})

	it("removes trailing zeros from decimal places", () => {
		expect(formatBytes(2048)).toBe("2 KB")
	})

	it("handles 1 byte", () => {
		expect(formatBytes(1)).toBe("1 B")
	})
})

describe("calculateCacheInfo", () => {
	const basePath = "/test/storage"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("returns correct structure with all fields", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockImplementation((dirPath: string) => {
			if (dirPath.includes("tasks")) return Promise.resolve(1000)
			if (dirPath.includes("checkpoints")) return Promise.resolve(2000)
			if (dirPath.includes("cache")) return Promise.resolve(500)
			return Promise.resolve(0)
		})

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockImplementation((dirPath: string) => {
			if (dirPath.includes("tasks")) {
				return Promise.resolve([
					{ name: "task1", isDirectory: () => true },
					{ name: "task2", isDirectory: () => true },
					{ name: "file.txt", isDirectory: () => false },
				])
			}
			if (dirPath.includes("checkpoints")) {
				return Promise.resolve([
					{ name: "cp1", isDirectory: () => true },
					{ name: "cp2", isDirectory: () => true },
					{ name: "cp3", isDirectory: () => true },
				])
			}
			return Promise.resolve([])
		})

		setupStatfs({ bsize: 4096, blocks: 1000000, bavail: 500000, bfree: 600000 })

		const result = await calculateCacheInfo(basePath)

		expect(result).toHaveProperty("tasksSize", 1000)
		expect(result).toHaveProperty("tasksCount", 2)
		expect(result).toHaveProperty("checkpointsSize", 2000)
		expect(result).toHaveProperty("checkpointsCount", 3)
		expect(result).toHaveProperty("cacheSize", 500)
		expect(result).toHaveProperty("totalSize", 3500)
		expect(result).toHaveProperty("diskTotal")
		expect(result).toHaveProperty("diskUsed")
		expect(result).toHaveProperty("diskAvailable")
	})

	it("handles missing directories gracefully", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockRejectedValue(new Error("ENOENT: no such file or directory"))

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockRejectedValue(new Error("ENOENT: no such file or directory"))

		setupStatfs({ bsize: 4096, blocks: 1000000, bavail: 500000, bfree: 600000 })

		const result = await calculateCacheInfo(basePath)

		expect(result.tasksSize).toBe(0)
		expect(result.tasksCount).toBe(0)
		expect(result.checkpointsSize).toBe(0)
		expect(result.checkpointsCount).toBe(0)
		expect(result.cacheSize).toBe(0)
		expect(result.totalSize).toBe(0)
	})

	it("handles statfs errors gracefully (returns zeros for disk info)", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(0)

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockResolvedValue([])

		setupStatfs(null)

		const result = await calculateCacheInfo(basePath)

		expect(result.diskTotal).toBe(0)
		expect(result.diskUsed).toBe(0)
		expect(result.diskAvailable).toBe(0)
	})

	it("calculates disk info correctly from statfs", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(0)

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockResolvedValue([])

		setupStatfs({ bsize: 4096, blocks: 1000000, bavail: 500000, bfree: 600000 })

		const result = await calculateCacheInfo(basePath)

		// diskTotal = bsize * blocks = 4096 * 1000000 = 4096000000
		expect(result.diskTotal).toBe(4096 * 1000000)
		// diskAvailable = bsize * bavail = 4096 * 500000 = 2048000000
		expect(result.diskAvailable).toBe(4096 * 500000)
		// diskUsed = diskTotal - bsize * bfree = 4096000000 - 4096 * 600000 = 1638400000
		expect(result.diskUsed).toBe(4096 * 1000000 - 4096 * 600000)
	})

	it("counts only directories, not files", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(0)

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockImplementation((dirPath: string) => {
			if (dirPath.includes("tasks")) {
				return Promise.resolve([
					{ name: "task1", isDirectory: () => true },
					{ name: "file1.txt", isDirectory: () => false },
					{ name: "file2.json", isDirectory: () => false },
				])
			}
			return Promise.resolve([])
		})

		setupStatfs({ bsize: 4096, blocks: 1000, bavail: 500, bfree: 600 })

		const result = await calculateCacheInfo(basePath)

		expect(result.tasksCount).toBe(1)
		expect(result.checkpointsCount).toBe(0)
	})
})

describe("clearAllCache", () => {
	const basePath = "/test/storage"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("deletes tasks, checkpoints, and cache directories", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockImplementation((dirPath: string) => {
			if (dirPath.includes("tasks")) return Promise.resolve(1000)
			if (dirPath.includes("checkpoints")) return Promise.resolve(2000)
			if (dirPath.includes("cache")) return Promise.resolve(500)
			return Promise.resolve(0)
		})

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockImplementation((dirPath: string) => {
			if (dirPath.includes("tasks")) {
				return Promise.resolve([
					{ name: "task1", isDirectory: () => true },
					{ name: "task2", isDirectory: () => true },
				])
			}
			if (dirPath.includes("checkpoints")) {
				return Promise.resolve([{ name: "cp1", isDirectory: () => true }])
			}
			return Promise.resolve([])
		})

		const rmMock = fsPromises.rm as ReturnType<typeof vi.fn>
		rmMock.mockResolvedValue(undefined)

		const result = await clearAllCache(basePath)

		// Verify rm was called for all three directories
		expect(rmMock).toHaveBeenCalledTimes(3)
		expect(rmMock).toHaveBeenCalledWith(expect.stringContaining("tasks"), { recursive: true, force: true })
		expect(rmMock).toHaveBeenCalledWith(expect.stringContaining("checkpoints"), { recursive: true, force: true })
		expect(rmMock).toHaveBeenCalledWith(expect.stringContaining("cache"), { recursive: true, force: true })

		expect(result.tasksDeleted).toBe(2)
		expect(result.checkpointsDeleted).toBe(1)
		expect(result.cacheCleared).toBe(true)
		expect(result.freedBytes).toBe(3500) // 1000 + 2000 + 500
	})

	it("returns correct counts and freed bytes", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockImplementation((dirPath: string) => {
			if (dirPath.includes("tasks")) return Promise.resolve(5000)
			if (dirPath.includes("checkpoints")) return Promise.resolve(3000)
			if (dirPath.includes("cache")) return Promise.resolve(1000)
			return Promise.resolve(0)
		})

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockResolvedValue([])

		const rmMock = fsPromises.rm as ReturnType<typeof vi.fn>
		rmMock.mockResolvedValue(undefined)

		const result = await clearAllCache(basePath)

		expect(result.tasksDeleted).toBe(0)
		expect(result.checkpointsDeleted).toBe(0)
		expect(result.freedBytes).toBe(9000) // 5000 + 3000 + 1000
	})

	it("handles errors gracefully when rm fails", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(100)

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockResolvedValue([])

		const rmMock = fsPromises.rm as ReturnType<typeof vi.fn>
		// First two succeed, third fails
		rmMock
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("Permission denied"))

		const result = await clearAllCache(basePath)

		// cacheCleared should be false since one deletion failed
		expect(result.cacheCleared).toBe(false)
	})

	it("handles getFolderSize errors gracefully", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockRejectedValue(new Error("ENOENT"))

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockRejectedValue(new Error("ENOENT"))

		const rmMock = fsPromises.rm as ReturnType<typeof vi.fn>
		rmMock.mockResolvedValue(undefined)

		const result = await clearAllCache(basePath)

		expect(result.tasksDeleted).toBe(0)
		expect(result.checkpointsDeleted).toBe(0)
		expect(result.freedBytes).toBe(0)
		expect(result.cacheCleared).toBe(true)
	})

	it("uses force option to prevent errors when directory doesn't exist", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(0)

		const readdirMock = fsPromises.readdir as ReturnType<typeof vi.fn>
		readdirMock.mockResolvedValue([])

		const rmMock = fsPromises.rm as ReturnType<typeof vi.fn>
		rmMock.mockResolvedValue(undefined)

		await clearAllCache(basePath)

		// Verify force: true is passed to all rm calls
		for (const call of rmMock.mock.calls) {
			expect(call[1]).toEqual({ recursive: true, force: true })
		}
	})
})

describe("calculateDirectorySize", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("returns size in bytes when directory has data", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(15_728_640) // ~15 MB

		const result = await calculateDirectorySize("/test/extension")

		expect(result).toBe(15_728_640)
		expect(mockGetFolderSize).toHaveBeenCalledWith("/test/extension")
	})

	it("returns 0 when directory does not exist", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockRejectedValue(new Error("ENOENT: no such file or directory"))

		const result = await calculateDirectorySize("/nonexistent/path")

		expect(result).toBe(0)
	})

	it("returns 0 when directory is empty", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(0)

		const result = await calculateDirectorySize("/empty/directory")

		expect(result).toBe(0)
	})

	it("returns 0 when getFolderSize throws an unexpected error", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockRejectedValue(new Error("Permission denied"))

		const result = await calculateDirectorySize("/protected/directory")

		expect(result).toBe(0)
	})

	it("passes the directory path correctly to getFolderSize", async () => {
		const mockGetFolderSize = getFolderSize.loose as ReturnType<typeof vi.fn>
		mockGetFolderSize.mockResolvedValue(1024)

		await calculateDirectorySize("/some/specific/path")

		expect(mockGetFolderSize).toHaveBeenCalledWith("/some/specific/path")
		expect(mockGetFolderSize).toHaveBeenCalledTimes(1)
	})
})
