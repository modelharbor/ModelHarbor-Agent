import "@testing-library/jest-dom"
import "@testing-library/jest-dom/vitest"

// Mock react-i18next globally
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: any) => {
			// Return the key for consistency in tests
			if (options && typeof options === "object") {
				// Handle interpolation for keys with variables
				let result = key
				Object.keys(options).forEach((param) => {
					result = result.replace(`{{${param}}}`, options[param])
				})
				return result
			}
			return key
		},
	}),
	Trans: ({ children }: { children: React.ReactNode }) => children,
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

// Mock i18next
vi.mock("i18next", () => ({
	default: {
		t: vi.fn((key: string, options?: any) => {
			// Return the key for consistency in tests
			if (options && typeof options === "object") {
				// Handle interpolation for keys with variables
				let result = key
				Object.keys(options).forEach((param) => {
					result = result.replace(`{{${param}}}`, options[param])
				})
				return result
			}
			return key
		}),
		use: vi.fn(() => ({
			init: vi.fn(),
		})),
		init: vi.fn(),
		changeLanguage: vi.fn(),
	},
}))

// Mock the i18n setup
vi.mock("@/i18n/setup", () => ({
	default: {
		t: vi.fn((key: string, options?: any) => {
			if (options && typeof options === "object") {
				let result = key
				Object.keys(options).forEach((param) => {
					result = result.replace(`{{${param}}}`, options[param])
				})
				return result
			}
			return key
		}),
		changeLanguage: vi.fn(),
	},
	loadTranslations: vi.fn(),
}))

// Mock TranslationContext
vi.mock("@/i18n/TranslationContext", () => {
	const MockTranslationProvider = ({ children }: { children: React.ReactNode }) => children

	const mockTranslate = (key: string, options?: any) => {
		// Handle specific test translations
		if (key === "settings.autoApprove.title") return "Auto-Approve"
		if (key === "notifications.error") {
			return options?.message ? `Operation failed: ${options.message}` : "Operation failed"
		}

		// Handle generic interpolation
		if (options && typeof options === "object") {
			let result = key
			Object.keys(options).forEach((param) => {
				result = result.replace(`{{${param}}}`, options[param])
			})
			return result
		}
		return key
	}

	return {
		TranslationContext: {
			Provider: ({ children }: { children: React.ReactNode }) => children,
		},
		TranslationProvider: MockTranslationProvider,
		default: MockTranslationProvider,
		useAppTranslation: () => ({
			t: mockTranslate,
			i18n: {
				t: mockTranslate,
				changeLanguage: vi.fn(),
			},
		}),
	}
})

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

global.ResizeObserver = MockResizeObserver

// Fix for Microsoft FAST Foundation compatibility with JSDOM
// FAST Foundation tries to set HTMLElement.focus property, but it's read-only in JSDOM
// The issue is that FAST Foundation's handleUnsupportedDelegatesFocus tries to set element.focus = originalFocus
// but JSDOM's HTMLElement.focus is a getter-only property
Object.defineProperty(HTMLElement.prototype, "focus", {
	get: function () {
		return (
			this._focus ||
			function () {
				// Mock focus behavior for tests
			}
		)
	},
	set: function (value) {
		this._focus = value
	},
	configurable: true,
})

Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn()

// Suppress console.log during tests to reduce noise.
// Keep console.error for actual errors.
const originalConsoleLog = console.log
const originalConsoleWarn = console.warn
const originalConsoleInfo = console.info

console.log = () => {}
console.warn = () => {}
console.info = () => {}

afterAll(() => {
	console.log = originalConsoleLog
	console.warn = originalConsoleWarn
	console.info = originalConsoleInfo
})
