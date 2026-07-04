import { describe, it, expect, vi, beforeEach } from "vitest"
import { countFileLines } from "../line-counter"

// Mock dependencies
vi.mock("fs", () => ({
	default: {
		promises: {
			access: vi.fn(),
		},
		constants: {
			F_OK: 0,
		},
		createReadStream: vi.fn(),
	},
	createReadStream: vi.fn(),
}))

// Get the mocked fs module
const fs = await import("fs")
const mockFsAccess = vi.mocked(fs.default.promises.access)

describe("line-counter", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("countFileLines", () => {
		it("should throw error for non-existent files", async () => {
			mockFsAccess.mockRejectedValue(new Error("ENOENT"))

			await expect(countFileLines("/nonexistent/file.txt")).rejects.toThrow("File not found")
		})
	})
})
