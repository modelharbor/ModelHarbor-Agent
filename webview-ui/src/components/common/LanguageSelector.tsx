import React, { useCallback } from "react"
import { Globe } from "lucide-react"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select"

interface LanguageSelectorProps {
	className?: string
	compact?: boolean
}

const AVAILABLE_LANGUAGES = [
	{ code: "en", name: "English", nativeName: "English" },
	{ code: "th", name: "Thai", nativeName: "ไทย" },
]

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = "", compact = false }) => {
	const { language } = useExtensionState()
	const { t } = useAppTranslation()

	const handleLanguageChange = useCallback((selectedLanguage: string) => {
		vscode.postMessage({ type: "language", text: selectedLanguage })
	}, [])

	const currentLanguage = AVAILABLE_LANGUAGES.find((lang) => lang.code === language) || AVAILABLE_LANGUAGES[0]

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{!compact && (
				<div className="flex items-center gap-1 text-sm text-vscode-descriptionForeground">
					<Globe className="w-4 h-4" />
					<span>{t("welcome:languageSelector.label")}</span>
				</div>
			)}
			<Select value={language} onValueChange={handleLanguageChange}>
				<SelectTrigger className="w-32">
					<SelectValue>
						<span className="flex items-center gap-2">
							{compact && <Globe className="w-4 h-4" />}
							<span>{currentLanguage.nativeName}</span>
						</span>
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{AVAILABLE_LANGUAGES.map((lang) => (
						<SelectItem key={lang.code} value={lang.code}>
							<span className="flex items-center gap-2">
								<span className="font-medium">{lang.nativeName}</span>
								<span className="text-xs text-vscode-descriptionForeground">({lang.name})</span>
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

export default LanguageSelector
