# RooIgnore Generator & Rules Generator — New Global Built-in Modes

**Date:** 2026-03-27

## Summary

Added two new built-in modes to `DEFAULT_MODES` that help users quickly onboard a workspace for AI-assisted development. **RooIgnore Generator** scans the workspace for large/binary/irrelevant files and creates a `.rooignore` to keep the AI context window clean. **Rules Generator** detects the project's tech stack from config files and generates `.roo/rules/*.md` rule files so the AI understands project conventions immediately.

## Problem

When users open a new or existing workspace with ModelHarbor Agent, two recurring friction points slow down the AI experience:

1. **Wasted context on irrelevant files.** Large files (SQL backups, big CSVs, binary assets, build artifacts, dependency directories) get pulled into the AI's context window, consuming tokens without providing useful information. Users had to manually create a `.rooignore` file, often not knowing the format or which files to exclude.

2. **No project-specific rules.** Without `.roo/rules/` files describing the tech stack, package manager, test framework, linting setup, and coding conventions, the AI operates without knowledge of the project's tooling and constraints. This leads to suggestions that violate project conventions (e.g., suggesting `npm` in a `pnpm` workspace, or Jest patterns in a Vitest project).

Both problems have the same root cause: workspace setup for AI is a manual process that most users skip.

## Solution

Two new modes that automate the setup, each with strict file restrictions to prevent accidental modifications to source code.

### Mode 1: `rooignore-generator` (🚫 RooIgnore Generator)

- Scans the entire workspace recursively, using `list_files` and OS-level commands to detect file sizes
- Categorizes findings into three tiers:
    - **Always ignore** — `node_modules/`, `dist/`, `build/`, `.venv/`, lock files over 500KB, IDE caches
    - **Recommend ignore** — large files (>1MB), database dumps, data files, binary/compiled files, media files, logs
    - **Context-dependent** — documentation PDFs, large test fixtures, generated code (asks user)
- Presents a summary table with estimated context savings before writing anything
- Creates or updates `.rooignore`, preserving any existing entries
- **File restriction:** can only edit `.rooignore` (regex: `^\.rooignore$`)
- Includes a caveat in the workflow: `.rooignore` is implicitly blocked from `read_file` by Roo's own system, so when updating an existing file the mode asks the user to paste current contents

### Mode 2: `rules-generator` (📏 Rules Generator)

- Detects the full tech stack by scanning for configuration files across 10 categories:
    - Package managers (pnpm, yarn, npm, uv, pipenv, poetry, cargo, go modules, bundler, composer)
    - Language & runtime (TypeScript, Python, Rust, Go, Java, Ruby, PHP)
    - Frameworks (Next.js, Nuxt, Vite, Angular, SvelteKit, Django, FastAPI, etc.)
    - Testing (Vitest, Jest, Cypress, Playwright, Pytest, Mocha)
    - Linting & formatting (ESLint, Prettier, Ruff, Biome, etc.)
    - Build & bundling (Turborepo, Webpack, esbuild, tsup, CMake)
    - Database (Prisma, Drizzle, Knex, Alembic, Diesel)
    - Infrastructure & CI/CD (Docker, GitHub Actions, Terraform, Vercel)
    - Git conventions (commitlint, husky, lint-staged)
- Checks existing `.roo/rules/` and skips any topics already covered
- Presents a detection summary table before generating
- Creates numbered rule files (`01-project-stack.md`, `02-coding-style.md`, `03-testing.md`, `04-commands.md`, `05-database.md`, `06-deployment.md`) as appropriate
- **File restriction:** can only edit `.roo/rules/*.md` (regex: `(^\.roo/rules/.*\.md$|^\.roo/rules/$)`)
- Never overwrites existing rule files

## Files Modified

- [`packages/types/src/mode.ts`](packages/types/src/mode.ts) — added 2 entries to the `DEFAULT_MODES` array (after `code-reviewer`)
- [`docs/design-rooignore-rules-generator-modes.md`](docs/design-rooignore-rules-generator-modes.md) — full design document with role definitions, custom instructions, file restrictions, and implementation details

## Verification

- **TypeScript type check:** passed — both mode objects conform to the `ModeConfig` type
- **44 existing tests:** all passed — no tests hardcode mode counts so no updates were needed
- No new tests required — these modes are pure configuration entries (role definitions and custom instructions), with no runtime logic to test

## Design Decisions

1. **No browser or MCP access.** Both modes work purely with local workspace files, so only `read`, `edit`, and `command` groups are granted.
2. **Strict file restrictions.** Each mode can only edit its specific output files, preventing accidental modifications to source code or configuration.
3. **Command access required.** RooIgnore Generator uses OS commands for file size detection; Rules Generator may use commands for version detection.
4. **Summary before action.** Both modes present what they plan to do and ask for user confirmation before writing any files.
5. **Preserve existing configurations.** Neither mode overwrites existing user content — RooIgnore Generator appends to `.rooignore`, Rules Generator skips existing rule files.
6. **Cross-platform commands.** Custom instructions include both Windows (`forfiles`, `cmd`) and Unix (`find`, `ls`) variants.

## References

- [Roo Code docs: .rooignore feature](https://docs.roocode.com/features/rooignore)
- [Roo Code docs: Custom Instructions / Rules](https://docs.roocode.com/features/custom-instructions)
