// npx vitest src/components/settings/__tests__/About.spec.tsx

import { render, screen, fireEvent, act } from "@/utils/test-utils"
import { createElement as h } from "react"

import { vscode } from "@/utils/vscode"
import { About } from "../About"

// Mock vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock translation - simple factory, no vi.importActual, no JSX
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: Record<string, any>) => (options ? `${key}:${JSON.stringify(options)}` : key),
	}),
}))

// Mock Package
vi.mock("@roo/package", () => ({
	Package: {
		version: "1.0.0",
		sha: "abc123def456",
	},
}))

// Mock useExtensionState - simple factory, no JSX
const mockUseExtensionState = vi.fn()
vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockUseExtensionState(),
}))

// Mock SearchableSetting - no JSX, just return children
vi.mock("../SearchableSetting", () => ({
	SearchableSetting: (props: any) => props.children,
}))

// Mock lucide-react icons - return null, no JSX
vi.mock("lucide-react", () => ({
	Info: () => null,
	Download: () => null,
	Upload: () => null,
	TriangleAlert: () => null,
	Trash2: () => null,
	RefreshCw: () => null,
	HardDrive: () => null,
	PackageIcon: () => null,
}))

// Mock @vscode/webview-ui-toolkit - no JSX
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: (props: any) => props.children,
	VSCodeLink: (props: any) => props.children,
}))

const defaultCacheInfo = {
	tasksSize: 1024 * 1024 * 50, // 50 MB
	tasksCount: 10,
	checkpointsSize: 1024 * 1024 * 200, // 200 MB
	checkpointsCount: 5,
	cacheSize: 1024 * 1024 * 30, // 30 MB
	totalSize: 1024 * 1024 * 280, // 280 MB
	diskTotal: 1024 * 1024 * 1024 * 500, // 500 GB
	diskUsed: 1024 * 1024 * 1024 * 250, // 250 GB
	diskAvailable: 1024 * 1024 * 1024 * 250, // 250 GB
}

describe("About - Cache Management", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.useFakeTimers()
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: undefined })
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("renders the About component with cache management section", () => {
		render(h(About))

		expect(screen.getByText(/Version: 1.0.0/)).toBeInTheDocument()
	})

	it("shows loading state when cacheInfo is undefined", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: undefined })
		render(h(About))

		expect(screen.getByText("settings:about.cacheManagement.loading")).toBeInTheDocument()
	})

	it("shows cache size breakdown when cacheInfo is available", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: defaultCacheInfo, extensionMetaInfo: undefined })
		render(h(About))

		expect(screen.getByText("settings:about.cacheManagement.totalCacheSize")).toBeInTheDocument()
		expect(screen.getByText("settings:about.cacheManagement.tasks")).toBeInTheDocument()
		expect(screen.getByText("settings:about.cacheManagement.checkpoints")).toBeInTheDocument()
		expect(screen.getByText("settings:about.cacheManagement.cache")).toBeInTheDocument()
	})

	it("shows disk usage progress bar with correct colors", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: defaultCacheInfo, extensionMetaInfo: undefined })
		render(h(About))

		expect(screen.getByText("settings:about.cacheManagement.diskUsage")).toBeInTheDocument()

		const progressBar = document.querySelector(".h-full.rounded-full.transition-all.duration-300")
		expect(progressBar).toBeInTheDocument()
		expect(progressBar?.className).toContain("bg-vscode-charts-green")
	})

	it("shows red disk bar when usage > 90%", () => {
		mockUseExtensionState.mockReturnValue({
			cacheInfo: {
				...defaultCacheInfo,
				diskUsed: 1024 * 1024 * 1024 * 460,
				diskTotal: 1024 * 1024 * 1024 * 500,
			},
			extensionMetaInfo: undefined,
		})
		render(h(About))

		const progressBar = document.querySelector(".h-full.rounded-full.transition-all.duration-300")
		expect(progressBar?.className).toContain("bg-vscode-charts-red")
	})

	it("shows yellow disk bar when usage > 70%", () => {
		mockUseExtensionState.mockReturnValue({
			cacheInfo: {
				...defaultCacheInfo,
				diskUsed: 1024 * 1024 * 1024 * 375,
				diskTotal: 1024 * 1024 * 1024 * 500,
			},
			extensionMetaInfo: undefined,
		})
		render(h(About))

		const progressBar = document.querySelector(".h-full.rounded-full.transition-all.duration-300")
		expect(progressBar?.className).toContain("bg-vscode-charts-yellow")
	})

	it("sends getCacheInfo message on mount", () => {
		render(h(About))

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "getCacheInfo" })
	})

	it("sends clearCache message when Clear Cache button is clicked", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: defaultCacheInfo, extensionMetaInfo: undefined })
		render(h(About))

		const clearButton = screen.getByRole("button", { name: /clearCache/ })
		fireEvent.click(clearButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "clearCache" })
	})

	it("disables Clear Cache button when cache is empty", () => {
		mockUseExtensionState.mockReturnValue({
			cacheInfo: { ...defaultCacheInfo, totalSize: 0 },
			extensionMetaInfo: undefined,
		})
		render(h(About))

		const clearButton = screen.getByRole("button", { name: /clearCache/ })
		expect(clearButton).toBeDisabled()
	})

	it("disables Clear Cache button when clearing is in progress", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: defaultCacheInfo, extensionMetaInfo: undefined })
		render(h(About))

		const clearButton = screen.getByRole("button", { name: /clearCache/ })
		fireEvent.click(clearButton)
		expect(clearButton).toBeDisabled()
	})

	it("re-enables Clear Cache button after clearing timeout", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: defaultCacheInfo, extensionMetaInfo: undefined })
		render(h(About))

		const clearButton = screen.getByRole("button", { name: /clearCache/ })
		fireEvent.click(clearButton)
		expect(clearButton).toBeDisabled()

		act(() => {
			vi.advanceTimersByTime(2000)
		})

		expect(clearButton).not.toBeDisabled()
	})

	it("sends getCacheInfo message when Refresh button is clicked", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: defaultCacheInfo, extensionMetaInfo: undefined })
		render(h(About))

		vi.mocked(vscode.postMessage).mockClear()

		const refreshButton = screen.getByRole("button", { name: /refresh/ })
		fireEvent.click(refreshButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "getCacheInfo" })
	})

	it("renders version information", () => {
		render(h(About))

		expect(screen.getByText(/Version: 1.0.0/)).toBeInTheDocument()
		expect(screen.getByText(/abc123de/)).toBeInTheDocument()
	})

	it("renders manage settings section", () => {
		render(h(About))

		expect(screen.getByRole("button", { name: /export/ })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /import/ })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /reset/ })).toBeInTheDocument()
	})
})

describe("About - Extension Information", () => {
	const mockExtensionMetaInfo = {
		identifier: "modelharbor.modelharbor-agent",
		version: "3.45.0",
		source: "VSIX",
		lastUpdated: "January 15, 2026",
		extensionSize: "12.5 MB",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: undefined })
	})

	it("does not render Extension Information section when extensionMetaInfo is undefined", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: undefined })
		render(h(About))

		expect(screen.queryByText("Extension Information")).not.toBeInTheDocument()
	})

	it("renders Extension Information section when extensionMetaInfo is present", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: mockExtensionMetaInfo })
		render(h(About))

		expect(screen.getByText("Extension Information")).toBeInTheDocument()
	})

	it("displays identifier correctly", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: mockExtensionMetaInfo })
		render(h(About))

		expect(screen.getByText("modelharbor.modelharbor-agent")).toBeInTheDocument()
	})

	it("displays version from extensionMetaInfo", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: mockExtensionMetaInfo })
		render(h(About))

		expect(screen.getByText("3.45.0")).toBeInTheDocument()
	})

	it("displays source correctly", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: mockExtensionMetaInfo })
		render(h(About))

		expect(screen.getByText("VSIX")).toBeInTheDocument()
	})

	it("displays lastUpdated when not Unknown", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: mockExtensionMetaInfo })
		render(h(About))

		expect(screen.getByText("January 15, 2026")).toBeInTheDocument()
	})

	it("hides lastUpdated when value is Unknown", () => {
		mockUseExtensionState.mockReturnValue({
			cacheInfo: undefined,
			extensionMetaInfo: { ...mockExtensionMetaInfo, lastUpdated: "Unknown" },
		})
		render(h(About))

		// "Last Updated" label should not be present since the value is "Unknown"
		expect(screen.queryByText("Last Updated")).not.toBeInTheDocument()
	})

	it("displays extensionSize when not Unknown", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: mockExtensionMetaInfo })
		render(h(About))

		expect(screen.getByText("12.5 MB")).toBeInTheDocument()
	})

	it("hides extensionSize when value is Unknown", () => {
		mockUseExtensionState.mockReturnValue({
			cacheInfo: undefined,
			extensionMetaInfo: { ...mockExtensionMetaInfo, extensionSize: "Unknown" },
		})
		render(h(About))

		// "Extension Size" label should not be present since the value is "Unknown"
		expect(screen.queryByText("Extension Size")).not.toBeInTheDocument()
	})

	it("renders version from Package object when extensionMetaInfo is absent", () => {
		mockUseExtensionState.mockReturnValue({ cacheInfo: undefined, extensionMetaInfo: undefined })
		render(h(About))

		// Version section still shows Package.version
		expect(screen.getByText(/Version: 1.0.0/)).toBeInTheDocument()
	})
})
