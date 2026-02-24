/**
 * Unit tests for diffStats utility functions.
 *
 * Tests for:
 * - computeDiffStats(): Computes diff statistics from a unified diff string
 * - computeBatchDiffStats(): Computes diff statistics for multiple file diffs
 * - aggregateDiffStats(): Aggregates multiple DiffStats into a single total
 */

import { describe, test, expect, it } from "vitest"
import { computeDiffStats, computeBatchDiffStats, aggregateDiffStats } from "../diffStats"

describe("computeDiffStats", () => {
	test("should return zero counts for empty string", () => {
		const result = computeDiffStats("")
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	test("should return zero counts for undefined input", () => {
		// @ts-expect-error - testing undefined handling
		const result = computeDiffStats(undefined)
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	test("should return zero counts for null input", () => {
		// @ts-expect-error - testing null handling
		const result = computeDiffStats(null)
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	test("should count a single added line", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 line 1
+new line`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 0 })
	})

	test("should count a single removed line", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1 @@
-line 1
 line 2`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 0, removed: 1 })
	})

	test("should count multiple added and removed lines", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,4 @@
-line 1
+modified line 1
 line 2
 line 3
+new line 4`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 2, removed: 1 })
	})

	test("should not count +++ as added lines", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 1 })
	})

	test("should not count --- as removed lines", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 1 })
	})

	test("should handle diff with context lines only (no changes)", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
 line 2
 line 3`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	test("should handle large diff with many changes", () => {
		const lines: string[] = ["--- a/large-file.txt", "+++ b/large-file.txt", "@@ -1,100 +1,120 @@"]

		// Add 20 removed lines
		for (let i = 1; i <= 20; i++) {
			lines.push(`-removed line ${i}`)
		}

		// Add 40 added lines
		for (let i = 1; i <= 40; i++) {
			lines.push(`+added line ${i}`)
		}

		// Add 80 context lines
		for (let i = 1; i <= 80; i++) {
			lines.push(` context line ${i}`)
		}

		const diff = lines.join("\n")
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 40, removed: 20 })
	})

	test("should handle multiple hunks", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1,2 +1,3 @@
 line 1
+inserted line
 line 2
@@ -10,2 +11,3 @@
 line 10
+another inserted
 line 11`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 2, removed: 0 })
	})

	test("should handle diff with only header lines", () => {
		const diff = `--- a/file.txt
+++ b/file.txt`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	it("should handle whitespace-only changes", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
- 
+  `
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 1 })
	})
})

describe("computeBatchDiffStats", () => {
	test("should return empty array for empty input", () => {
		const result = computeBatchDiffStats([])
		expect(result).toEqual([])
	})

	test("should compute stats for single file", () => {
		const diffs = [
			{
				path: "file1.txt",
				content: `--- a/file1.txt
+++ b/file1.txt
@@ -1 +1,2 @@
 line 1
+new line`,
			},
		]
		const result = computeBatchDiffStats(diffs)
		expect(result).toEqual([{ path: "file1.txt", added: 1, removed: 0 }])
	})

	test("should compute stats for multiple files", () => {
		const diffs = [
			{
				path: "file1.txt",
				content: `--- a/file1.txt
+++ b/file1.txt
@@ -1 +1,2 @@
 line 1
+new line`,
			},
			{
				path: "file2.txt",
				content: `--- a/file2.txt
+++ b/file2.txt
@@ -1,2 +1 @@
-line 1
 line 2`,
			},
			{
				path: "file3.txt",
				content: `--- a/file3.txt
+++ b/file3.txt
@@ -1,2 +1,3 @@
-old line
+new line 1
+new line 2`,
			},
		]
		const result = computeBatchDiffStats(diffs)
		expect(result).toEqual([
			{ path: "file1.txt", added: 1, removed: 0 },
			{ path: "file2.txt", added: 0, removed: 1 },
			{ path: "file3.txt", added: 2, removed: 1 },
		])
	})

	test("should handle files with no changes", () => {
		const diffs = [
			{
				path: "unchanged.txt",
				content: `--- a/unchanged.txt
+++ b/unchanged.txt
@@ -1,2 +1,2 @@
 line 1
 line 2`,
			},
		]
		const result = computeBatchDiffStats(diffs)
		expect(result).toEqual([{ path: "unchanged.txt", added: 0, removed: 0 }])
	})

	test("should handle empty content for a file", () => {
		const diffs = [
			{
				path: "empty.txt",
				content: "",
			},
		]
		const result = computeBatchDiffStats(diffs)
		expect(result).toEqual([{ path: "empty.txt", added: 0, removed: 0 }])
	})
})

describe("aggregateDiffStats", () => {
	test("should return zero counts for empty array", () => {
		const result = aggregateDiffStats([])
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	test("should return stats for single item", () => {
		const result = aggregateDiffStats([{ added: 5, removed: 3 }])
		expect(result).toEqual({ added: 5, removed: 3 })
	})

	test("should aggregate multiple stats objects", () => {
		const stats = [
			{ added: 5, removed: 2, path: "file1.txt" },
			{ added: 3, removed: 1, path: "file2.txt" },
			{ added: 10, removed: 5, path: "file3.txt" },
		]
		const result = aggregateDiffStats(stats)
		expect(result).toEqual({ added: 18, removed: 8 })
	})

	test("should handle stats with zero values", () => {
		const stats = [
			{ added: 0, removed: 0 },
			{ added: 5, removed: 3 },
			{ added: 0, removed: 2 },
		]
		const result = aggregateDiffStats(stats)
		expect(result).toEqual({ added: 5, removed: 5 })
	})

	test("should handle large numbers", () => {
		const stats = [
			{ added: 1000, removed: 500 },
			{ added: 2000, removed: 1000 },
			{ added: 500, removed: 250 },
		]
		const result = aggregateDiffStats(stats)
		expect(result).toEqual({ added: 3500, removed: 1750 })
	})

	test("should ignore path property in aggregation", () => {
		const stats = [
			{ added: 5, removed: 2, path: "file1.txt" },
			{ added: 3, removed: 1, path: "file2.txt" },
		]
		const result = aggregateDiffStats(stats)
		expect(result).toEqual({ added: 8, removed: 3 })
		expect((result as any).path).toBeUndefined()
	})
})

describe("edge cases", () => {
	test("should handle diff with only newlines", () => {
		const diff = "\n\n\n"
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 0, removed: 0 })
	})

	test("should handle diff with special characters", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 line 1
+line with + special + characters`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 0 })
	})

	test("should handle diff with unicode characters", () => {
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 line 1
+行を追加する`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 0 })
	})

	test("should handle very long lines", () => {
		const longLine = "+".padEnd(10000, "a")
		const diff = `--- a/file.txt
+++ b/file.txt
@@ -1 +1,2 @@
 line 1
${longLine}`
		const result = computeDiffStats(diff)
		expect(result).toEqual({ added: 1, removed: 0 })
	})

	test("should handle mixed line endings (CRLF and LF)", () => {
		const diff = "--- a/file.txt\r\n+++ b/file.txt\r\n@@ -1 +1,2 @@\r\n line 1\r\n+new line\n"
		const result = computeDiffStats(diff)
		// Should count correctly regardless of line ending mix
		expect(result.added).toBeGreaterThanOrEqual(1)
	})
})
