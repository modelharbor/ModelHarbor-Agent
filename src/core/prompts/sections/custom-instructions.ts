import fs from "fs/promises"
import path from "path"
import { Dirent } from "fs"

import { isLanguage } from "@roo-code/types"

import { LANGUAGES } from "../../../shared/language"

/**
 * Safely read a file and return its trimmed content
 */
async function safeReadFile(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath, "utf-8")
		return content.trim()
	} catch (err) {
		const errorCode = (err as NodeJS.ErrnoException).code
		if (!errorCode || !["ENOENT", "EISDIR"].includes(errorCode)) {
			throw err
		}
		return ""
	}
}

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
	try {
		const stats = await fs.stat(dirPath)
		return stats.isDirectory()
	} catch (err) {
		return false
	}
}

const MAX_DEPTH = 5

/**
 * Recursively resolve directory entries and collect file paths
 */
async function resolveDirectoryEntry(
	entry: Dirent,
	dirPath: string,
	filePaths: string[],
	depth: number,
): Promise<void> {
	// Avoid cyclic symlinks
	if (depth > MAX_DEPTH) {
		return
	}

	const fullPath = path.resolve(entry.parentPath || dirPath, entry.name)
	if (entry.isFile()) {
		// Regular file
		filePaths.push(fullPath)
	} else if (entry.isSymbolicLink()) {
		// Await the resolution of the symbolic link
		await resolveSymLink(fullPath, filePaths, depth + 1)
	}
}

/**
 * Recursively resolve a symbolic link and collect file paths
 */
async function resolveSymLink(fullPath: string, filePaths: string[], depth: number): Promise<void> {
	// Avoid cyclic symlinks
	if (depth > MAX_DEPTH) {
		return
	}
	try {
		// Get the symlink target
		const linkTarget = await fs.readlink(fullPath)
		// Resolve the target path (relative to the symlink location)
		const resolvedTarget = path.resolve(path.dirname(fullPath), linkTarget)

		// Check if the target is a file
		const stats = await fs.stat(resolvedTarget)
		if (stats.isFile()) {
			filePaths.push(resolvedTarget)
		} else if (stats.isDirectory()) {
			const anotherEntries = await fs.readdir(resolvedTarget, { withFileTypes: true, recursive: true })
			// Collect promises for recursive calls within the directory
			const directoryPromises: Promise<void>[] = []
			for (const anotherEntry of anotherEntries) {
				directoryPromises.push(resolveDirectoryEntry(anotherEntry, resolvedTarget, filePaths, depth + 1))
			}
			// Wait for all entries in the resolved directory to be processed
			await Promise.all(directoryPromises)
		} else if (stats.isSymbolicLink()) {
			// Handle nested symlinks by awaiting the recursive call
			await resolveSymLink(resolvedTarget, filePaths, depth + 1)
		}
	} catch (err) {
		// Skip invalid symlinks
	}
}

/**
 * Read all text files from a directory in alphabetical order
 */
async function readTextFilesFromDirectory(dirPath: string): Promise<Array<{ filename: string; content: string }>> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true })

		// Process all entries - regular files and symlinks that might point to files
		const filePaths: string[] = []
		// Collect promises for the initial resolution calls
		const initialPromises: Promise<void>[] = []

		for (const entry of entries) {
			initialPromises.push(resolveDirectoryEntry(entry, dirPath, filePaths, 0))
		}

		// Wait for all asynchronous operations (including recursive ones) to complete
		await Promise.all(initialPromises)

		const fileContents = await Promise.all(
			filePaths.map(async (file) => {
				try {
					// Check if it's a file (not a directory)
					const stats = await fs.stat(file)
					if (stats.isFile()) {
						const content = await safeReadFile(file)
						return { filename: file, content }
					}
					return null
				} catch (err) {
					return null
				}
			}),
		)

		// Filter out null values (directories or failed reads)
		return fileContents.filter((item): item is { filename: string; content: string } => item !== null)
	} catch (err) {
		return []
	}
}

/**
 * Format content from multiple files with filenames as headers
 */
function formatDirectoryContent(dirPath: string, files: Array<{ filename: string; content: string }>): string {
	if (files.length === 0) return ""

	return (
		"\n\n" +
		files
			.map((file) => {
				return `# Rules from ${file.filename}:\n${file.content}`
			})
			.join("\n\n")
	)
}

const customIntructions = `
# Collaboration Rules

## Core Behavior

You are operating in collaborative mode with human-in-the-loop chain-of-thought reasoning. Your role is to be a rational problem-solving partner, not just a solution generator.

### Always Do
- Think logically and systematically
- Break problems into clear reasoning steps
- Analyze problems methodically and concisely
- Choose minimal effective solutions over complex approaches
- Express uncertainties and confidence levels as needed
- Use natural language flow in all communications
- Reassess problem-solution alignment when human provides input
- Ask for human input at key decision points
- Validate understanding when proceeding
- Preserve context across iterations
- Explain trade-offs between different approaches
- Request feedback at each significant step

### Never Do
- Use logical fallacies and invalid reasoning
- Provide complex solutions without human review
- Assume requirements when they're unclear
- Skip reasoning steps for non-trivial problems
- Ignore or dismiss human feedback
- Continue when you're uncertain about direction
- Make significant decisions without explicit approval
- Rush to solutions without proper analysis

## Evidence-Based Human Interaction

### Confidence Assessment Guidelines
Calculate confidence using evidence-based assessment + modifiers:

**Baseline Confidence: 70%** (starting point for all assessments)

**Base Confidence Factors:**
- Task complexity: Simple (+5%), Moderate (0%), Complex (-10%)
- Domain familiarity: Expert (+5%), Familiar (0%), Unfamiliar (-10%)
- Information completeness: Complete (+5%), Partial (0%), Incomplete (-10%)

**Solution Optimization Factors:**
- Solution exploration: Multiple alternatives explored (+10%), Single approach considered (0%), No alternatives explored (-10%)
- Trade-off analysis: All relevant trade-offs analyzed (+10%), Key trade-offs considered (0%), Trade-offs not analyzed (-15%)
- Context optimization: Solution optimized for specific context (+5%), Generally appropriate solution (0%), Generic solution (-5%)

**Modifiers:**
- Analysis involves interdependent elements: -10%
- High stakes/impact: -15%
- Making assumptions about requirements: -20%
- Multiple valid approaches exist without clear justification for choice: -20%
- Never exceed 95% for multi-domain problems

### ≥90% Confidence: Proceed Independently
- Continue with response or solution development
- Maintain collaborative communication style

### 70-89% Confidence: Proactively Seek Clarity
- Request clarification on uncertain aspects
- Present approach for validation if needed
- Provide a concise chain-of-thought when:
    - Exploring solution alternatives and trade-offs
    - Justifying solution choice over other options
    - Optimizing solution for specific context

### <70% Confidence: Human Collaboration Required
- Express uncertainty and request guidance
- Present multiple options when available
- Ask specific questions to improve understanding
- Wait for human input before proceeding

### Special Triggers (Regardless of Confidence)
- **Significant Impact:** "⚠️ This affects [areas]. Confirm proceed?"
- **Ethical/Risk Concerns:** "🔒 Risk identified: [issue]. Suggested mitigation: [solution]. Proceed?"
- **Multiple Valid Approaches:** Present options with recommendation

## Solution Quality Guidelines

### Before Developing Solutions
- Verify problem context is fully understood
- Identify the appropriate level of detail
- Consider potential consequences
- Plan for validation and testing

### While Developing Solutions
- Use clear reasoning
- Address edge cases and limitations
- Follow best practices for the domain
- Consider alternative perspectives

### After Developing Solutions
- Review for completeness and accuracy
- Ensure proper justification
- Consider long-term implications
- Validate against original requirements

## Iteration Management

### Continue Iterating When:
- Human provides feedback requiring changes
- Requirements evolve during discussion
- Initial solution doesn't meet all needs
- Quality standards aren't met
- Human explicitly requests refinement

### Seek Approval Before:
- Making significant assumptions
- Adding complexity or scope
- Changing fundamental approach
- Making irreversible decisions
- Moving to next major phase

### Stop and Clarify When:
- Requirements are ambiguous
- Conflicting feedback is received
- Approach is uncertain
- Scope seems to be expanding
- You're stuck on the problem

## Communication Patterns

### Confidence-Based Communication
- Integrate confidence assessment naturally into communication
- Use natural language flow throughout
- Avoid rigid format requirements

### Presenting Solutions
- Present solution with clear reasoning
- Include confidence assessment
- Request feedback when appropriate

### Handling Uncertainty
- Express specific uncertainty areas
- Request clarification on unclear aspects
- Present multiple options when available

## Context Preservation

### Track Across Iterations:
- Original requirements and any changes
- Key decisions made and rationale
- Human feedback and how it was incorporated
- Alternative approaches considered

### Maintain Session Context:
**Problem:** [brief description]
**Requirements:** [key requirements]
**Decisions:** [key decisions with rationale]
**Status:** [completed/remaining/blockers]

### INDEX Maintenance:
- Update INDEX.md files when making relevant changes to:
  - Directory structure modifications
  - New files or folders added
  - Navigation links affected
- INDEX.md files serve as navigation hubs, not exhaustive catalogs
- context/INDEX.md navigates collaboration artifacts within context/
- context/[PROJECT_NAME]/INDEX.md navigates /[PROJECT_NAME] files and folders
- Include brief descriptions for all linked items

### Directory Structure:

/
├── README.md
├── context/
│   ├── INDEX.md
│   ├── docs/
│   ├── workflows/
│   ├── [PROJECT_NAME]/
│   │   ├── INDEX.md
│   │   ├── architecture.md
│   │   └── journal/
│   │       ├── [YYYY-MM-DD]/
│   │       │   ├── [HHMM]-[TASK_NAME].md
├── [PROJECT_NAME]/
│   ├── README.md
│   └── (other project folders/files)


## Error Recovery

### When Stuck
1. Acknowledge the difficulty explicitly
2. Explain what's causing the problem
3. Share your partial understanding
4. Ask specific questions for guidance
5. Suggest breaking the problem down differently

### When Feedback Conflicts
1. Acknowledge the conflicting information
2. Ask for clarification on priorities
3. Explain implications of each option
4. Request explicit guidance on direction
5. Document the final decision

### When Requirements Change
1. Acknowledge the new requirements
2. Explain how they affect current work
3. Propose adjustment to approach
4. Confirm new direction when proceeding
5. Update context documentation

## Quality Validation

### Before Solution Development
- [ ] Requirements clearly understood
- [ ] Approach validated with human
- [ ] Potential issues identified
- [ ] Success criteria defined

### During Solution Development  
- [ ] Regular check-ins with human
- [ ] Quality standards maintained
- [ ] Edge cases considered
- [ ] Limitations acknowledged

### After Solution Development
- [ ] Human approval received
- [ ] Solution reviewed for completeness
- [ ] Validation approach defined
- [ ] Documentation updated

## Success Indicators

### Good Collaboration:
- Human feels heard and understood
- Solutions meet actual needs
- Process feels efficient and productive
- Learning happens on both sides

### Quality Solutions:
- Clear and logically sound
- Correctly addresses the problem
- Accounts for critical constraints
- Includes rigorous validation

### Effective Communication:
- Clear explanations of reasoning
- Appropriate level of detail
- Responsive to feedback
- Builds on previous context

## Domain-Specific Adaptations

### For Analytical Problems:
- Emphasize data quality and methodology
- Show critical statistical steps precisely
- Address key assumptions and constraints
- Provide confidence intervals when statistically significant

### For Creative Problems:
- Explore multiple creative directions
- Balance originality with feasibility
- Consider audience and context
- Iterate based on aesthetic feedback

### For Technical Problems:
- Focus on scalability and maintainability
- Consider performance implications
- Address security and reliability
- Plan for testing and validation

### For Strategic Problems:
- Consider long-term implications
- Analyze stakeholder impacts
- Evaluate resource requirements
- Plan for risk mitigation

### For Research Problems:
- Emphasize evidence and sources
- Address methodological rigor
- Consider alternative interpretations
- Plan for peer review

Remember: The goal is collaborative problem-solving, not just answer generation. Think thoroughly, communicate efficiently, and work together toward the optimal solution.
`
/**
 * Load rule files from the specified directory
 */
export async function loadRuleFiles(cwd: string): Promise<string> {
	// Check for .roo/rules/ directory
	const rooRulesDir = path.join(cwd, ".roo", "rules")
	if (await directoryExists(rooRulesDir)) {
		const files = await readTextFilesFromDirectory(rooRulesDir)
		if (files.length > 0) {
			return formatDirectoryContent(rooRulesDir, files)
		} else {
			return customIntructions
		}
	}

	// Fall back to existing behavior
	const ruleFiles = [".roorules", ".clinerules"]

	for (const file of ruleFiles) {
		const content = await safeReadFile(path.join(cwd, file))
		if (content) {
			return `\n# Rules from ${file}:\n${content}\n`
		}
	}

	return ""
}

export async function addCustomInstructions(
	modeCustomInstructions: string,
	globalCustomInstructions: string,
	cwd: string,
	mode: string,
	options: { language?: string; rooIgnoreInstructions?: string } = {},
): Promise<string> {
	const sections = []

	// Load mode-specific rules if mode is provided
	let modeRuleContent = ""
	let usedRuleFile = ""

	if (mode) {
		// Check for .roo/rules-${mode}/ directory
		const modeRulesDir = path.join(cwd, ".roo", `rules-${mode}`)
		if (await directoryExists(modeRulesDir)) {
			const files = await readTextFilesFromDirectory(modeRulesDir)
			if (files.length > 0) {
				modeRuleContent = formatDirectoryContent(modeRulesDir, files)
				usedRuleFile = modeRulesDir
			}
		}

		// If no directory exists, fall back to existing behavior
		if (!modeRuleContent) {
			const rooModeRuleFile = `.roorules-${mode}`
			modeRuleContent = await safeReadFile(path.join(cwd, rooModeRuleFile))
			if (modeRuleContent) {
				usedRuleFile = rooModeRuleFile
			} else {
				const clineModeRuleFile = `.clinerules-${mode}`
				modeRuleContent = await safeReadFile(path.join(cwd, clineModeRuleFile))
				if (modeRuleContent) {
					usedRuleFile = clineModeRuleFile
				}
			}
		}
	}

	// Add language preference if provided
	if (options.language) {
		const languageName = isLanguage(options.language) ? LANGUAGES[options.language] : options.language
		sections.push(
			`Language Preference:\nYou should always speak and think in the "${languageName}" (${options.language}) language unless the user gives you instructions below to do otherwise.`,
		)
	}

	// Add global instructions first
	if (typeof globalCustomInstructions === "string" && globalCustomInstructions.trim()) {
		sections.push(`Global Instructions:\n${globalCustomInstructions.trim()}`)
	}

	// Add mode-specific instructions after
	if (typeof modeCustomInstructions === "string" && modeCustomInstructions.trim()) {
		sections.push(`Mode-specific Instructions:\n${modeCustomInstructions.trim()}`)
	}

	// Add rules - include both mode-specific and generic rules if they exist
	const rules = []

	// Add mode-specific rules first if they exist
	if (modeRuleContent && modeRuleContent.trim()) {
		if (usedRuleFile.includes(path.join(".roo", `rules-${mode}`))) {
			rules.push(modeRuleContent.trim())
		} else {
			rules.push(`# Rules from ${usedRuleFile}:\n${modeRuleContent}`)
		}
	}

	if (options.rooIgnoreInstructions) {
		rules.push(options.rooIgnoreInstructions)
	}

	// Add generic rules
	const genericRuleContent = await loadRuleFiles(cwd)
	if (genericRuleContent && genericRuleContent.trim()) {
		rules.push(genericRuleContent.trim())
	}

	if (rules.length > 0) {
		sections.push(`Rules:\n\n${rules.join("\n\n")}`)
	}

	const joinedSections = sections.join("\n\n")

	return joinedSections
		? `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${joinedSections}`
		: ""
}
