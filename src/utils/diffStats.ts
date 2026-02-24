/**
 * DiffStats
 *
 * Represents statistics about changes in a file diff.
 */
export interface DiffStats {
	/** Number of lines added */
	added: number
	/** Number of lines removed */
	removed: number
	/** File path (optional, included for batch operations) */
	path?: string
}

/**
 * Computes diff statistics from a unified diff string.
 *
 * @param diff - Unified diff string
 * @returns DiffStats with added and removed line counts
 *
 * @example
 * ```typescript
 * const diff = `--- a/file.txt
 * +++ b/file.txt
 * @@ -1,3 +1,4 @@
 *  line 1
 * +new line
 *  line 2
 *  line 3`
 *
 * const stats = computeDiffStats(diff)
 * // stats: { added: 1, removed: 0 }
 * ```
 */
export function computeDiffStats(diff: string): DiffStats {
	if (!diff) {
		return { added: 0, removed: 0 }
	}

	let added = 0
	let removed = 0

	const lines = diff.split("\n")

	for (const line of lines) {
		// Count added lines (start with + but not +++)
		if (line.startsWith("+") && !line.startsWith("+++")) {
			added++
		}
		// Count removed lines (start with - but not ---)
		else if (line.startsWith("-") && !line.startsWith("---")) {
			removed++
		}
	}

	return { added, removed }
}

/**
 * Computes diff statistics for multiple file diffs.
 *
 * @param diffs - Array of objects containing diff content and optional path
 * @returns Array of DiffStats with path and line counts
 *
 * @example
 * ```typescript
 * const diffs = [
 *   { path: 'file1.txt', content: '--- a/file1.txt\n+++ b/file1.txt\n@@ -1 +1,2 @@\n+new line' },
 *   { path: 'file2.txt', content: '--- a/file2.txt\n+++ b/file2.txt\n@@ -1,2 +1 @@\n-removed line' }
 * ]
 *
 * const stats = computeBatchDiffStats(diffs)
 * // stats: [{ added: 1, removed: 0, path: 'file1.txt' }, { added: 0, removed: 1, path: 'file2.txt' }]
 * ```
 */
export function computeBatchDiffStats(
	diffs: Array<{ path: string; content: string }>,
): Array<DiffStats & { path: string }> {
	return diffs.map(({ path, content }) => ({
		path,
		...computeDiffStats(content),
	}))
}

/**
 * Aggregates multiple DiffStats into a single total.
 *
 * @param statsArray - Array of DiffStats to aggregate
 * @returns Single DiffStats with total added and removed counts
 *
 * @example
 * ```typescript
 * const stats = [
 *   { added: 5, removed: 2, path: 'file1.txt' },
 *   { added: 3, removed: 1, path: 'file2.txt' }
 * ]
 *
 * const total = aggregateDiffStats(stats)
 * // total: { added: 8, removed: 3 }
 * ```
 */
export function aggregateDiffStats(statsArray: DiffStats[]): DiffStats {
	return statsArray.reduce(
		(total, stats) => ({
			added: total.added + stats.added,
			removed: total.removed + stats.removed,
		}),
		{ added: 0, removed: 0 },
	)
}
