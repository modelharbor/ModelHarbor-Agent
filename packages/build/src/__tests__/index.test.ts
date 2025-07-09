// npx vitest run src/__tests__/index.test.ts

import { generatePackageJson } from "../index.js"

describe("generatePackageJson", () => {
	it("should be a test", () => {
		const generatedPackageJson = generatePackageJson({
			packageJson: {
				name: "modelharbor-agent",
				displayName: "%extension.displayName%",
				description: "%extension.description%",
				publisher: "RooVeterinaryInc",
				version: "3.17.2",
				icon: "assets/icons/icon.png",
				contributes: {
					viewsContainers: {
						activitybar: [
							{
								id: "modelharbor-agent-ActivityBar",
								title: "%views.activitybar.title%",
								icon: "assets/icons/icon.svg",
							},
						],
					},
					views: {
						"modelharbor-agent-ActivityBar": [
							{
								type: "webview",
								id: "modelharbor-agent.SidebarProvider",
								name: "",
							},
						],
					},
					commands: [
						{
							command: "modelharbor-agent.plusButtonClicked",
							title: "%command.newTask.title%",
							icon: "$(add)",
						},
						{
							command: "modelharbor-agent.openInNewTab",
							title: "%command.openInNewTab.title%",
							category: "%configuration.title%",
						},
					],
					menus: {
						"editor/context": [
							{
								submenu: "modelharbor-agent.contextMenu",
								group: "navigation",
							},
						],
						"modelharbor-agent.contextMenu": [
							{
								command: "modelharbor-agent.addToContext",
								group: "1_actions@1",
							},
						],
						"editor/title": [
							{
								command: "modelharbor-agent.plusButtonClicked",
								group: "navigation@1",
								when: "activeWebviewPanelId == modelharbor-agent.TabPanelProvider",
							},
							{
								command: "modelharbor-agent.settingsButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == modelharbor-agent.TabPanelProvider",
							},
							{
								command: "modelharbor-agent.accountButtonClicked",
								group: "navigation@6",
								when: "activeWebviewPanelId == modelharbor-agent.TabPanelProvider",
							},
						],
					},
					submenus: [
						{
							id: "modelharbor-agent.contextMenu",
							label: "%views.contextMenu.label%",
						},
						{
							id: "modelharbor-agent.terminalMenu",
							label: "%views.terminalMenu.label%",
						},
					],
					configuration: {
						title: "%configuration.title%",
						properties: {
							"modelharbor-agent.allowedCommands": {
								type: "array",
								items: {
									type: "string",
								},
								default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
								description: "%commands.allowedCommands.description%",
							},
							"modelharbor-agent.customStoragePath": {
								type: "string",
								default: "",
								description: "%settings.customStoragePath.description%",
							},
						},
					},
				},
				scripts: {
					lint: "eslint **/*.ts",
				},
			},
			overrideJson: {
				name: "roo-code-nightly",
				displayName: "Roo Code Nightly",
				publisher: "RooVeterinaryInc",
				version: "0.0.1",
				icon: "assets/icons/icon-nightly.png",
				scripts: {},
			},
			substitution: ["modelharbor-agent", "roo-code-nightly"],
		})

		expect(generatedPackageJson).toStrictEqual({
			name: "roo-code-nightly",
			displayName: "Roo Code Nightly",
			description: "%extension.description%",
			publisher: "RooVeterinaryInc",
			version: "0.0.1",
			icon: "assets/icons/icon-nightly.png",
			contributes: {
				viewsContainers: {
					activitybar: [
						{
							id: "roo-code-nightly-ActivityBar",
							title: "%views.activitybar.title%",
							icon: "assets/icons/icon.svg",
						},
					],
				},
				views: {
					"roo-code-nightly-ActivityBar": [
						{
							type: "webview",
							id: "roo-code-nightly.SidebarProvider",
							name: "",
						},
					],
				},
				commands: [
					{
						command: "roo-code-nightly.plusButtonClicked",
						title: "%command.newTask.title%",
						icon: "$(add)",
					},
					{
						command: "roo-code-nightly.openInNewTab",
						title: "%command.openInNewTab.title%",
						category: "%configuration.title%",
					},
				],
				menus: {
					"editor/context": [
						{
							submenu: "roo-code-nightly.contextMenu",
							group: "navigation",
						},
					],
					"roo-code-nightly.contextMenu": [
						{
							command: "roo-code-nightly.addToContext",
							group: "1_actions@1",
						},
					],
					"editor/title": [
						{
							command: "roo-code-nightly.plusButtonClicked",
							group: "navigation@1",
							when: "activeWebviewPanelId == roo-code-nightly.TabPanelProvider",
						},
						{
							command: "roo-code-nightly.settingsButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == roo-code-nightly.TabPanelProvider",
						},
						{
							command: "roo-code-nightly.accountButtonClicked",
							group: "navigation@6",
							when: "activeWebviewPanelId == roo-code-nightly.TabPanelProvider",
						},
					],
				},
				submenus: [
					{
						id: "roo-code-nightly.contextMenu",
						label: "%views.contextMenu.label%",
					},
					{
						id: "roo-code-nightly.terminalMenu",
						label: "%views.terminalMenu.label%",
					},
				],
				configuration: {
					title: "%configuration.title%",
					properties: {
						"roo-code-nightly.allowedCommands": {
							type: "array",
							items: {
								type: "string",
							},
							default: ["npm test", "npm install", "tsc", "git log", "git diff", "git show"],
							description: "%commands.allowedCommands.description%",
						},
						"roo-code-nightly.customStoragePath": {
							type: "string",
							default: "",
							description: "%settings.customStoragePath.description%",
						},
					},
				},
			},
			scripts: {},
		})
	})
})
