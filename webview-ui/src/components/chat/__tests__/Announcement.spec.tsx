import { render, screen } from "@/utils/test-utils"

import { Package } from "@roo/package"

import Announcement from "../Announcement"

// Mock the components from @src/components/ui
vi.mock("@src/components/ui", () => ({
	Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
		<button onClick={onClick}>{children}</button>
	),
}))

// Mock the useAppTranslation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: { version: string }) => {
			if (key === "chat:announcement.title") {
				return `🎉 ModelHarbor Agent ${options?.version} Released`
			}
			if (key === "chat:announcement.description") {
				return `ModelHarbor Agent ${options?.version} brings powerful new features and significant improvements to enhance your development workflow.`
			}
			if (key === "chat:announcement.whatsNew") {
				return "What's New"
			}
			if (key === "chat:announcement.hideButton") {
				return "Hide announcement"
			}
			if (key === "chat:announcement.detailsDiscussLinks") {
				return "Visit our website www.modelharbor.com 🚀"
			}
			// Return key for other translations not relevant to this test
			return key
		},
	}),
}))

describe("Announcement", () => {
	const mockHideAnnouncement = vi.fn()
	const expectedVersion = Package.version

	it("renders the announcement with the version number from package.json", () => {
		render(<Announcement hideAnnouncement={mockHideAnnouncement} />)

		// Check if the mocked version number is present in the title
		expect(screen.getByText(`🎉 ModelHarbor Agent ${expectedVersion} Released`)).toBeInTheDocument()

		// Check if the new announcement elements are present
		expect(
			screen.getByText(
				`ModelHarbor Agent ${expectedVersion} brings powerful new features and significant improvements to enhance your development workflow.`,
			),
		).toBeInTheDocument()
		expect(screen.getByText("What's New")).toBeInTheDocument()
		expect(screen.getByText("Hide announcement")).toBeInTheDocument()
		expect(screen.getByText("Visit our website www.modelharbor.com 🚀")).toBeInTheDocument()
	})
})
