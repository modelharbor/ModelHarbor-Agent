import fs from "fs/promises"
import path from "path"
import os from "os"
import { readFileWithTokenBudget } from "../read-file-with-budget"

describe("readFileWithTokenBudget", () => {
	let tempDir: string

	beforeEach(async () => {
		// Create a temporary directory for test files
		tempDir = path.join(os.tmpdir(), `read-file-budget-test-${Date.now()}`)
		await fs.mkdir(tempDir, { recursive: true })
	})

	afterEach(async () => {
		// Clean up temporary directory
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	describe("Basic functionality", () => {
		test("reads entire small file when within budget", async () => {
			const filePath = path.join(tempDir, "small.txt")
			const content = "Line 1\nLine 2\nLine 3"
			await fs.writeFile(filePath, content)

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000, // Large budget
			})

			expect(result.content).toBe(content)
			expect(result.lineCount).toBe(3)
			expect(result.complete).toBe(true)
			expect(result.tokenCount).toBeGreaterThan(0)
			expect(result.tokenCount).toBeLessThan(1000)
		})

		test("returns correct token count", async () => {
			const filePath = path.join(tempDir, "token-test.txt")
			const content = "This is a test file with some content."
			await fs.writeFile(filePath, content)

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			// Token count should be reasonable (rough estimate: 1 token per 3-4 chars)
			expect(result.tokenCount).toBeGreaterThan(5)
			expect(result.tokenCount).toBeLessThan(20)
		})

		test("returns complete: true for files within budget", async () => {
			const filePath = path.join(tempDir, "within-budget.txt")
			const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(filePath, lines.join("\n"))

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			expect(result.complete).toBe(true)
			expect(result.lineCount).toBe(10)
		})
	})

	describe("Budget flagging (no truncation)", () => {
		// Note: readFileWithTokenBudget now reads the entire file and reports
		// whether the content fits within budget via `complete`. It no longer
		// truncates content or stops reading early — this avoids a readline
		// race condition that produced "readline was closed" errors.

		test("flags complete: false when content exceeds budget", async () => {
			const filePath = path.join(tempDir, "large.txt")
			// Create a file with many lines
			const lines = Array.from({ length: 1000 }, (_, i) => `This is line number ${i + 1} with some content`)
			await fs.writeFile(filePath, lines.join("\n"))

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 50, // Small budget
			})

			expect(result.complete).toBe(false)
			// Full content is always returned now
			expect(result.lineCount).toBe(1000)
			expect(result.tokenCount).toBeGreaterThan(50)
		})

		test("returns complete: false when budget smaller than content", async () => {
			const filePath = path.join(tempDir, "truncated.txt")
			const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(filePath, lines.join("\n"))

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 20,
			})

			expect(result.complete).toBe(false)
			expect(result.tokenCount).toBeGreaterThan(20)
		})

		test("returns full content without line splitting", async () => {
			const filePath = path.join(tempDir, "line-boundary.txt")
			const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(filePath, lines.join("\n"))

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 30,
			})

			// Content is returned whole; line count matches content
			const contentLines = result.content.split("\n")
			expect(contentLines.length).toBe(result.lineCount)
			expect(result.lineCount).toBe(100)
			// Last line should be complete (not cut off)
			expect(contentLines[contentLines.length - 1]).toMatch(/^Line \d+$/)
		})

		test("reads full file regardless of chunk size option", async () => {
			const filePath = path.join(tempDir, "chunks.txt")
			const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(filePath, lines.join("\n"))

			// chunkLines is now ignored; both calls return the full file
			const result1 = await readFileWithTokenBudget(filePath, {
				budgetTokens: 50,
				chunkLines: 10,
			})

			const result2 = await readFileWithTokenBudget(filePath, {
				budgetTokens: 50,
				chunkLines: 500,
			})

			expect(result1.complete).toBe(false)
			expect(result2.complete).toBe(false)
			expect(result1.lineCount).toBe(1000)
			expect(result2.lineCount).toBe(1000)
			expect(result1.content).toBe(result2.content)
		})
	})

	describe("Edge cases", () => {
		test("handles empty file", async () => {
			const filePath = path.join(tempDir, "empty.txt")
			await fs.writeFile(filePath, "")

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 100,
			})

			expect(result.content).toBe("")
			expect(result.lineCount).toBe(0)
			expect(result.tokenCount).toBe(0)
			expect(result.complete).toBe(true)
		})

		test("handles single line file", async () => {
			const filePath = path.join(tempDir, "single-line.txt")
			await fs.writeFile(filePath, "Single line content")

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 100,
			})

			expect(result.content).toBe("Single line content")
			expect(result.lineCount).toBe(1)
			expect(result.complete).toBe(true)
		})

		test("handles budget of 0 tokens", async () => {
			const filePath = path.join(tempDir, "zero-budget.txt")
			await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3")

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 0,
			})

			// Full content is returned; complete is false because tokens > 0 budget
			expect(result.content).toBe("Line 1\nLine 2\nLine 3")
			expect(result.lineCount).toBe(3)
			expect(result.tokenCount).toBeGreaterThan(0)
			expect(result.complete).toBe(false)
		})

		test("handles very small budget (fewer tokens than content)", async () => {
			const filePath = path.join(tempDir, "tiny-budget.txt")
			const longLine = "This is a very long line with lots of content that will exceed a tiny token budget"
			await fs.writeFile(filePath, `${longLine}\nLine 2\nLine 3`)

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 2, // Very small budget
			})

			// Full content returned; flagged as exceeding budget
			expect(result.content).toBe(`${longLine}\nLine 2\nLine 3`)
			expect(result.lineCount).toBe(3)
			expect(result.complete).toBe(false)
		})

		test("throws error for non-existent file", async () => {
			const filePath = path.join(tempDir, "does-not-exist.txt")

			await expect(
				readFileWithTokenBudget(filePath, {
					budgetTokens: 100,
				}),
			).rejects.toThrow("File not found")
		})

		test("handles file with no trailing newline", async () => {
			const filePath = path.join(tempDir, "no-trailing-newline.txt")
			await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3")

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			expect(result.content).toBe("Line 1\nLine 2\nLine 3")
			expect(result.lineCount).toBe(3)
			expect(result.complete).toBe(true)
		})

		test("handles file with trailing newline", async () => {
			const filePath = path.join(tempDir, "trailing-newline.txt")
			await fs.writeFile(filePath, "Line 1\nLine 2\nLine 3\n")

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			// Content is returned as-is including the trailing newline
			expect(result.content).toBe("Line 1\nLine 2\nLine 3\n")
			expect(result.lineCount).toBe(3)
			expect(result.complete).toBe(true)
		})
	})

	describe("Token counting accuracy", () => {
		test("returned tokenCount matches actual tokens in content", async () => {
			const filePath = path.join(tempDir, "accuracy.txt")
			const content = "Hello world\nThis is a test\nWith some content"
			await fs.writeFile(filePath, content)

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			// Verify the token count is reasonable
			// Rough estimate: 1 token per 3-4 characters
			const minExpected = Math.floor(content.length / 5)
			const maxExpected = Math.ceil(content.length / 2)

			expect(result.tokenCount).toBeGreaterThanOrEqual(minExpected)
			expect(result.tokenCount).toBeLessThanOrEqual(maxExpected)
		})

		test("handles special characters correctly", async () => {
			const filePath = path.join(tempDir, "special-chars.txt")
			const content = "Special chars: @#$%^&*()\nUnicode: 你好世界\nEmoji: 😀🎉"
			await fs.writeFile(filePath, content)

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			expect(result.content).toBe(content)
			expect(result.tokenCount).toBeGreaterThan(0)
			expect(result.complete).toBe(true)
		})

		test("handles code content", async () => {
			const filePath = path.join(tempDir, "code.ts")
			const code = `function hello(name: string): string {\n  return \`Hello, \${name}!\`\n}`
			await fs.writeFile(filePath, code)

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 1000,
			})

			expect(result.content).toBe(code)
			expect(result.tokenCount).toBeGreaterThan(0)
			expect(result.complete).toBe(true)
		})
	})

	describe("Performance", () => {
		test("reads large files without crashing", async () => {
			const filePath = path.join(tempDir, "large-file.txt")
			// Create a 1MB file
			const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1} with some additional content`)
			await fs.writeFile(filePath, lines.join("\n"))

			const startTime = Date.now()

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 100,
			})

			const endTime = Date.now()
			const duration = endTime - startTime

			// Should complete in reasonable time (less than 5 seconds)
			expect(duration).toBeLessThan(5000)
			// Reads full file, so it exceeds the small budget
			expect(result.complete).toBe(false)
			expect(result.lineCount).toBe(10000)
			expect(result.tokenCount).toBeGreaterThan(100)
		})

		test("reads entire file regardless of budget", async () => {
			const filePath = path.join(tempDir, "early-exit.txt")
			// Create a very large file
			const lines = Array.from({ length: 50000 }, (_, i) => `Line ${i + 1}`)
			await fs.writeFile(filePath, lines.join("\n"))

			const startTime = Date.now()

			const result = await readFileWithTokenBudget(filePath, {
				budgetTokens: 50, // Small budget — no longer triggers early exit
			})

			const endTime = Date.now()
			const duration = endTime - startTime

			// Should complete in reasonable time (less than 5 seconds)
			expect(duration).toBeLessThan(5000)
			expect(result.complete).toBe(false)
			expect(result.lineCount).toBe(50000)
		})
	})
})
