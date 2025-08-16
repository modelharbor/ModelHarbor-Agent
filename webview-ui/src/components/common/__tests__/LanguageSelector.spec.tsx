import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import LanguageSelector from "../LanguageSelector"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"

// Mock the dependencies
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(),
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: vi.fn(),
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("LanguageSelector", () => {
	const mockT = vi.fn((key: string) => {
		if (key === "welcome:languageSelector.label") return "Language"
		return key
	})

	beforeEach(() => {
		vi.mocked(useExtensionState).mockReturnValue({
			language: "en",
		} as any)

		vi.mocked(useAppTranslation).mockReturnValue({
			t: mockT,
		} as any)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("renders with English selected by default", () => {
		render(<LanguageSelector />)

		expect(screen.getByText("Language")).toBeInTheDocument()
		expect(screen.getByText("English")).toBeInTheDocument()
	})

	it("renders in compact mode without label", () => {
		render(<LanguageSelector compact />)

		expect(screen.queryByText("Language")).not.toBeInTheDocument()
		expect(screen.getByText("English")).toBeInTheDocument()
	})

	it("displays Thai when language is set to th", () => {
		vi.mocked(useExtensionState).mockReturnValue({
			language: "th",
		} as any)

		render(<LanguageSelector />)

		expect(screen.getByText("ไทย")).toBeInTheDocument()
	})

	it("applies custom className", () => {
		const { container } = render(<LanguageSelector className="custom-class" />)

		expect(container.firstChild).toHaveClass("custom-class")
	})
})
