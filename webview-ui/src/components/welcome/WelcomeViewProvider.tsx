import { useCallback, useState } from "react"

import type { ProviderSettings } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"
import { Trans } from "react-i18next"

type ProviderOption = "custom" | null

export const WelcomeViewProvider = () => {
	const { t } = useAppTranslation()
	const { apiConfiguration, setApiConfiguration } = useExtensionState()
	const [selectedProvider, setSelectedProvider] = useState<ProviderOption>(null)
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [uriScheme] = useState<string>("modelharbor-agent")

	const handleGetStarted = useCallback(() => {
		// Navigate to the next screen
		setSelectedProvider("custom")
	}, [])

	const handleBackToLanding = useCallback(() => {
		setSelectedProvider(null)
	}, [])

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration],
	)

	// Landing screen - shown when selectedProvider === null
	if (selectedProvider === null) {
		return (
			<Tab>
				<TabContent className="flex flex-col gap-4 p-6 justify-center">
					<RooHero />
					<h2 className="mt-0 mb-0 text-xl">{t("welcome:greeting")}</h2>

					<div className="space-y-4 leading-normal">
						<p className="text-base text-vscode-foreground">
							<Trans i18nKey="welcome:introduction" />
						</p>
					</div>

					<div className="mt-2 flex gap-2 items-center">
						<Button onClick={handleGetStarted} variant="primary">
							{t("welcome:start")}
						</Button>
					</div>
				</TabContent>
			</Tab>
		)
	}

	// Provider Selection screen - shown when selectedProvider is "custom"
	return (
		<Tab>
			<TabContent className="flex flex-col gap-4 p-6 justify-center">
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:providerSignup.heading")}</h2>

				<p className="text-base text-vscode-foreground">
					<Trans i18nKey="welcome:chooseProvider" />
				</p>

				<div>
					{/* Expand API options for custom provider */}
					<div className="mb-8">
						<ApiOptions
							fromWelcomeView
							apiConfiguration={apiConfiguration || {}}
							uriScheme={uriScheme}
							setApiConfigurationField={setApiConfigurationFieldForApiOptions}
							errorMessage={errorMessage}
							setErrorMessage={setErrorMessage}
						/>
					</div>
				</div>

				<div className="-mt-4 flex gap-2">
					<Button onClick={handleBackToLanding} variant="secondary">
						{t("welcome:providerSignup.getStarted")}
					</Button>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
