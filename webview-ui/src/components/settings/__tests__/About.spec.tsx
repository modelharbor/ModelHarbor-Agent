import { render, screen } from "@/utils/test-utils"

import { TranslationProvider } from "@/i18n/__mocks__/TranslationContext"

import { About } from "../About"

vi.mock("@/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("@/i18n/TranslationContext", () => {
	const actual = vi.importActual("@/i18n/TranslationContext")
	return {
		...actual,
		useAppTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("@roo/package", () => ({
	Package: {
		version: "1.0.0",
		sha: "abc12345",
	},
}))

describe("About", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the About section header", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:sections.about")).toBeInTheDocument()
	})

	it("displays version information", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText(/Version: 1\.0\.0/)).toBeInTheDocument()
	})

	it("renders the contact and community section", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:about.contactAndCommunity")).toBeInTheDocument()
		expect(screen.getByText("www.modelharbor.com")).toBeInTheDocument()
	})

	it("renders the manage settings section", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:about.manageSettings")).toBeInTheDocument()
	})

	it("renders export, import, and reset buttons", () => {
		render(
			<TranslationProvider>
				<About />
			</TranslationProvider>,
		)
		expect(screen.getByText("settings:footer.settings.export")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.import")).toBeInTheDocument()
		expect(screen.getByText("settings:footer.settings.reset")).toBeInTheDocument()
	})
})
