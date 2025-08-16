import { useState, memo } from "react"
import { Trans } from "react-i18next"

import { Package } from "@roo/package"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@src/components/ui"

interface AnnouncementProps {
	hideAnnouncement: () => void
}

/**
 * You must update the `latestAnnouncementId` in ClineProvider for new
 * announcements to show to users. This new id will be compared with what's in
 * state for the 'last announcement shown', and if it's different then the
 * announcement will render. As soon as an announcement is shown, the id will be
 * updated in state. This ensures that announcements are not shown more than
 * once, even if the user doesn't close it themselves.
 */

const Announcement = ({ hideAnnouncement }: AnnouncementProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(true)

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				setOpen(open)

				if (!open) {
					hideAnnouncement()
				}
			}}>
			<DialogContent className="max-w-96">
				<DialogHeader>
					<DialogTitle>{t("chat:announcement.title", { version: Package.version })}</DialogTitle>
				</DialogHeader>
				<div>
					<p className="mb-4 text-vscode-descriptionForeground">
						{t("chat:announcement.description", { version: Package.version })}
					</p>

					<h3 className="text-sm font-semibold mb-3 text-vscode-foreground">
						{t("chat:announcement.whatsNew")}
					</h3>

					<div className="space-y-3 mb-4">
						<div>
							<Trans
								i18nKey="chat:announcement.feature1"
								components={{
									bold: <b />,
								}}
							/>
						</div>

						<div>
							<Trans
								i18nKey="chat:announcement.feature2"
								components={{
									bold: <b />,
								}}
							/>
						</div>
					</div>

					<div className="mt-4 text-sm text-center text-vscode-descriptionForeground">
						{t("chat:announcement.detailsDiscussLinks")}
					</div>
					</div>

					<div className="mt-4">
						<Button
							onClick={() => {
								setOpen(false)
								hideAnnouncement()
							}}
							className="w-full">
							{t("chat:announcement.hideButton")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default memo(Announcement)
