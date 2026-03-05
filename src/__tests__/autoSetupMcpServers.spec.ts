// cd src && npx vitest run __tests__/autoSetupMcpServers.spec.ts

import * as fs from "fs/promises"
import * as path from "path"

import { autoSetupMcpServers } from "../utils/autoSetupMcpServers"

vi.mock("fs/promises", () => ({
	readFile: vi.fn(),
	writeFile: vi.fn(),
	mkdir: vi.fn(),
	access: vi.fn(),
}))

vi.mock("../utils/globalContext", () => ({
	ensureSettingsDirectoryExists: vi.fn().mockResolvedValue("/mock/settings/dir"),
}))

vi.mock("../utils/safeWriteJson", () => ({
	safeWriteJson: vi.fn().mockResolvedValue(undefined),
}))

const mockFs = vi.mocked(fs)

import { safeWriteJson } from "../utils/safeWriteJson"

const mockSafeWriteJson = vi.mocked(safeWriteJson)

const EXPECTED_CONTEXT7_CONFIG = {
	command: "npx",
	args: ["-y", "@upstash/context7-mcp@latest"],
	alwaysAllow: ["resolve-library-id", "query-docs"],
}

const mcpSettingsPath = path.join("/mock/settings/dir", "mcp_settings.json")

describe("autoSetupMcpServers", () => {
	let mockContext: any

	beforeEach(() => {
		vi.clearAllMocks()
		mockContext = {} as any
	})

	it("should create file with context7 config when mcp_settings.json does not exist", async () => {
		const notFoundError = new Error("File not found") as any
		notFoundError.code = "ENOENT"
		mockFs.readFile.mockRejectedValueOnce(notFoundError)

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).toHaveBeenCalledWith(mcpSettingsPath, {
			mcpServers: {
				context7: EXPECTED_CONTEXT7_CONFIG,
			},
		})
	})

	it("should add context7 to existing servers when mcp_settings.json exists without context7", async () => {
		const existingData = {
			mcpServers: {
				"other-server": { command: "other", args: ["--flag"] },
			},
		}
		mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingData))

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).toHaveBeenCalledWith(mcpSettingsPath, {
			mcpServers: {
				"other-server": { command: "other", args: ["--flag"] },
				context7: EXPECTED_CONTEXT7_CONFIG,
			},
		})
	})

	it("should NOT modify the file when context7 is already configured", async () => {
		const existingData = {
			mcpServers: {
				context7: { command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] },
			},
		}
		mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingData))

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).not.toHaveBeenCalled()
	})

	it("should create fresh config with context7 when file has invalid JSON", async () => {
		mockFs.readFile.mockResolvedValueOnce("{ invalid json }")

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).toHaveBeenCalledWith(mcpSettingsPath, {
			mcpServers: {
				context7: EXPECTED_CONTEXT7_CONFIG,
			},
		})
	})

	it("should preserve existing MCP server entries when adding context7", async () => {
		const existingData = {
			mcpServers: {
				"server-a": { command: "a", args: [] },
				"server-b": { command: "b", args: ["--verbose"] },
			},
		}
		mockFs.readFile.mockResolvedValueOnce(JSON.stringify(existingData))

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).toHaveBeenCalledTimes(1)
		const writtenData = mockSafeWriteJson.mock.calls[0][1] as any
		expect(writtenData.mcpServers["server-a"]).toEqual({ command: "a", args: [] })
		expect(writtenData.mcpServers["server-b"]).toEqual({ command: "b", args: ["--verbose"] })
		expect(writtenData.mcpServers["context7"]).toEqual(EXPECTED_CONTEXT7_CONFIG)
	})

	it("should handle file with empty mcpServers object", async () => {
		mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ mcpServers: {} }))

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).toHaveBeenCalledWith(mcpSettingsPath, {
			mcpServers: {
				context7: EXPECTED_CONTEXT7_CONFIG,
			},
		})
	})

	it("should handle file with missing mcpServers key", async () => {
		mockFs.readFile.mockResolvedValueOnce(JSON.stringify({ otherKey: "value" }))

		await autoSetupMcpServers(mockContext)

		expect(mockSafeWriteJson).toHaveBeenCalledWith(mcpSettingsPath, {
			otherKey: "value",
			mcpServers: {
				context7: EXPECTED_CONTEXT7_CONFIG,
			},
		})
	})

	it("should re-throw unexpected file read errors", async () => {
		const permError = new Error("Permission denied") as any
		permError.code = "EACCES"
		mockFs.readFile.mockRejectedValueOnce(permError)

		await expect(autoSetupMcpServers(mockContext)).rejects.toThrow("Permission denied")

		expect(mockSafeWriteJson).not.toHaveBeenCalled()
	})
})
