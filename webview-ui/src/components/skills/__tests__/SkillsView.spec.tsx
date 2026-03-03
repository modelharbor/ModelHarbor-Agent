import { render, screen, act, fireEvent } from "@/utils/test-utils"

import type { SkillMetadata } from "@roo-code/types"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import SkillsView from "../SkillsView"

// Mock vscode postMessage
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
		getState: vi.fn(),
		setState: vi.fn(),
	},
}))

// Mock i18n
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: Record<string, any>) => {
			const translations: Record<string, string> = {
				"skills:title": "Skills",
				"skills:description": "Skills are reusable instructions...",
				"skills:emptyState": "No skills found. Create a skill or add SKILL.md files to .roo/skills/",
				"skills:projectSkills": "Project Skills",
				"skills:globalSkills": "Global Skills",
				"skills:actions.refresh": "Refresh",
				"skills:actions.openDirectory": "Open Folder",
				"skills:actions.create": "+ New Skill",
				"skills:row.edit": "Edit in editor",
				"skills:row.delete": "Delete",
				"skills:deleteDialog.title": "Delete Skill",
				"skills:deleteDialog.description": `Are you sure you want to delete the skill "${options?.name}"?`,
				"skills:deleteDialog.cancel": "Cancel",
				"skills:deleteDialog.delete": "Delete",
				"skills:createDialog.title": "Create New Skill",
				"skills:createDialog.name": "Name",
				"skills:createDialog.namePlaceholder": "my-skill",
				"skills:createDialog.nameHelp": "Lowercase letters, numbers, and hyphens only",
				"skills:createDialog.description": "Description",
				"skills:createDialog.descriptionPlaceholder": "When to use this skill",
				"skills:createDialog.source": "Location",
				"skills:createDialog.sourceProject": "Project (.roo/skills/)",
				"skills:createDialog.sourceGlobal": "Global (~/.roo/skills/)",
				"skills:createDialog.mode": "Mode (optional)",
				"skills:createDialog.modePlaceholder": "e.g. code, architect",
				"skills:createDialog.modeHelp": "If set, skill is only available in this mode",
				"skills:createDialog.instructions": "Instructions (optional)",
				"skills:createDialog.instructionsPlaceholder": "Skill instructions in markdown...",
				"skills:createDialog.cancel": "Cancel",
				"skills:createDialog.create": "Create",
			}
			return translations[key] ?? key
		},
		i18n: { language: "en" },
	}),
}))

const renderSkillsView = () => {
	return render(
		<ExtensionStateContextProvider>
			<SkillsView />
		</ExtensionStateContextProvider>,
	)
}

const sendSkillsListMessage = (skills: SkillMetadata[]) => {
	act(() => {
		window.dispatchEvent(
			new MessageEvent("message", {
				data: {
					type: "skillsList",
					skills,
				},
			}),
		)
	})
}

describe("SkillsView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("requests skills on mount", () => {
		renderSkillsView()
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestSkills" })
	})

	it("renders empty state when no skills", () => {
		renderSkillsView()
		expect(
			screen.getByText("No skills found. Create a skill or add SKILL.md files to .roo/skills/"),
		).toBeInTheDocument()
	})

	it("renders title", () => {
		renderSkillsView()
		expect(screen.getByText("Skills")).toBeInTheDocument()
	})

	it("renders action buttons", () => {
		renderSkillsView()
		expect(screen.getByText("Refresh")).toBeInTheDocument()
		expect(screen.getByText("Open Folder")).toBeInTheDocument()
		expect(screen.getByText("+ New Skill")).toBeInTheDocument()
	})

	it("sends refresh message when refresh button is clicked", () => {
		renderSkillsView()
		fireEvent.click(screen.getByText("Refresh"))
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "refreshSkills" })
	})

	it("sends openSkillsDirectory message when open folder button is clicked", () => {
		renderSkillsView()
		fireEvent.click(screen.getByText("Open Folder"))
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "openSkillsDirectory" })
	})

	it("renders skills grouped by source", () => {
		renderSkillsView()

		const mockSkills: SkillMetadata[] = [
			{
				name: "project-skill",
				description: "A project skill",
				path: "/project/.roo/skills/project-skill/SKILL.md",
				source: "project",
			},
			{
				name: "global-skill",
				description: "A global skill",
				path: "/home/.roo/skills/global-skill/SKILL.md",
				source: "global",
			},
		]

		sendSkillsListMessage(mockSkills)

		expect(screen.getByText("Project Skills")).toBeInTheDocument()
		expect(screen.getByText("Global Skills")).toBeInTheDocument()
		expect(screen.getByText("project-skill")).toBeInTheDocument()
		expect(screen.getByText("global-skill")).toBeInTheDocument()
	})

	it("shows skill description in the row", () => {
		renderSkillsView()

		const mockSkills: SkillMetadata[] = [
			{
				name: "my-skill",
				description: "Helps with testing",
				path: "/path/to/skill",
				source: "project",
			},
		]

		sendSkillsListMessage(mockSkills)

		expect(screen.getByText("Helps with testing")).toBeInTheDocument()
	})

	it("shows mode badge when skill has a mode", () => {
		renderSkillsView()

		const mockSkills: SkillMetadata[] = [
			{
				name: "code-skill",
				description: "A code-only skill",
				path: "/path/to/skill",
				source: "project",
				mode: "code",
			},
		]

		sendSkillsListMessage(mockSkills)

		// The mode should appear as a badge
		expect(screen.getByText("code")).toBeInTheDocument()
	})

	it("expands skill row on click to show details", () => {
		renderSkillsView()

		const mockSkills: SkillMetadata[] = [
			{
				name: "expandable-skill",
				description: "Click me to expand",
				path: "/project/.roo/skills/expandable-skill/SKILL.md",
				source: "project",
			},
		]

		sendSkillsListMessage(mockSkills)

		// Click the row to expand
		fireEvent.click(screen.getByText("expandable-skill"))

		// Should show path info and edit button
		expect(screen.getByText("Edit in editor")).toBeInTheDocument()
		expect(screen.getByText(/\/project\/.roo\/skills\/expandable-skill\/SKILL.md/)).toBeInTheDocument()
	})

	it("collapses expanded skill row on second click", () => {
		renderSkillsView()

		const mockSkills: SkillMetadata[] = [
			{
				name: "toggle-skill",
				description: "Toggle me",
				path: "/path/to/skill",
				source: "project",
			},
		]

		sendSkillsListMessage(mockSkills)

		// Click to expand
		fireEvent.click(screen.getByText("toggle-skill"))
		expect(screen.getByText("Edit in editor")).toBeInTheDocument()

		// Click to collapse
		fireEvent.click(screen.getByText("toggle-skill"))
		expect(screen.queryByText("Edit in editor")).not.toBeInTheDocument()
	})

	it("opens create dialog when New Skill button is clicked", () => {
		renderSkillsView()
		fireEvent.click(screen.getByText("+ New Skill"))
		expect(screen.getByText("Create New Skill")).toBeInTheDocument()
	})

	it("hides empty state when skills exist", () => {
		renderSkillsView()

		const mockSkills: SkillMetadata[] = [
			{
				name: "some-skill",
				description: "A skill",
				path: "/path/to/skill",
				source: "project",
			},
		]

		sendSkillsListMessage(mockSkills)

		expect(
			screen.queryByText("No skills found. Create a skill or add SKILL.md files to .roo/skills/"),
		).not.toBeInTheDocument()
	})
})
