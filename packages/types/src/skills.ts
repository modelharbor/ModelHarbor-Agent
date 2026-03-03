/**
 * Skill Types
 *
 * Platform-agnostic type definitions for skills (SKILL.md files).
 * Skills are discovered from `.roo/skills/` and `~/.roo/skills/` directories.
 */

/**
 * Skill metadata for discovery (loaded at startup).
 * Only name and description are required for listing.
 */
export interface SkillMetadata {
	/** Skill identifier (directory name) */
	name: string
	/** When to use this skill */
	description: string
	/** Absolute path to SKILL.md */
	path: string
	/** Where the skill was discovered */
	source: "global" | "project"
	/** If set, skill is only available in this mode */
	mode?: string
}

/**
 * Full skill content (loaded on activation).
 */
export interface SkillContent extends SkillMetadata {
	/** Full markdown body (instructions) */
	instructions: string
}
