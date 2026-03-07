import React, { useState, useEffect } from "react"
import { Trans } from "react-i18next"

import type { SkillMetadata } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import {
	Button,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	Input,
	Textarea,
} from "@src/components/ui"
import { Section } from "@src/components/settings/Section"
import { SectionHeader } from "@src/components/settings/SectionHeader"

const SkillsView = () => {
	const { skills } = useExtensionState()
	const { t } = useAppTranslation()
	const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
	const [showCreateDialog, setShowCreateDialog] = useState(false)
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

	// Request skills on mount
	useEffect(() => {
		vscode.postMessage({ type: "requestSkills" })
	}, [])

	const handleRefresh = () => {
		vscode.postMessage({ type: "refreshSkills" })
	}

	const handleOpenDirectory = () => {
		vscode.postMessage({ type: "openSkillsDirectory" })
	}

	const handleOpenFile = (name: string) => {
		vscode.postMessage({ type: "openSkillFile", text: name })
	}

	const handleDelete = (name: string, source: string) => {
		vscode.postMessage({ type: "deleteSkill", text: name, values: { source } })
		setDeleteConfirm(null)
	}

	const handleCreate = (values: {
		name: string
		description: string
		source: string
		mode?: string
		instructions?: string
	}) => {
		vscode.postMessage({ type: "createSkill", values })
		setShowCreateDialog(false)
	}

	// Group skills by source
	const projectSkills = skills.filter((s) => s.source === "project")
	const globalSkills = skills.filter((s) => s.source === "global")

	const getSkillKey = (skill: SkillMetadata) => `${skill.name}-${skill.source}`

	return (
		<div>
			<SectionHeader>{t("skills:title")}</SectionHeader>

			<Section>
				<div
					style={{
						color: "var(--vscode-foreground)",
						marginBottom: "10px",
						marginTop: "5px",
					}}>
					<Trans i18nKey="skills:description">
						Skills are reusable instructions (SKILL.md files) that can be automatically included in the
						system prompt. Place them in <code>.roo/skills/</code> (project) or <code>~/.roo/skills/</code>{" "}
						(global).
					</Trans>
				</div>

				{/* Action Buttons */}
				<div
					style={{
						marginBottom: "10px",
						width: "100%",
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
						gap: "10px",
					}}>
					<Button variant="secondary" style={{ width: "100%" }} onClick={handleRefresh}>
						<span className="codicon codicon-refresh" style={{ marginRight: "6px" }}></span>
						{t("skills:actions.refresh")}
					</Button>
					<Button variant="secondary" style={{ width: "100%" }} onClick={handleOpenDirectory}>
						<span className="codicon codicon-folder-opened" style={{ marginRight: "6px" }}></span>
						{t("skills:actions.openDirectory")}
					</Button>
					<Button variant="secondary" style={{ width: "100%" }} onClick={() => setShowCreateDialog(true)}>
						<span className="codicon codicon-add" style={{ marginRight: "6px" }}></span>
						{t("skills:actions.create")}
					</Button>
				</div>

				{/* Skills List */}
				{skills.length === 0 ? (
					<div
						style={{
							textAlign: "center",
							color: "var(--vscode-descriptionForeground)",
							padding: "32px 0",
						}}>
						{t("skills:emptyState")}
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
						{/* Project Skills */}
						{projectSkills.length > 0 && (
							<div>
								<div
									className="text-sm"
									style={{
										fontWeight: 500,
										color: "var(--vscode-descriptionForeground)",
										marginBottom: "8px",
									}}>
									{t("skills:projectSkills")}
								</div>
								{projectSkills.map((skill) => (
									<SkillRow
										key={getSkillKey(skill)}
										skill={skill}
										isExpanded={expandedSkill === getSkillKey(skill)}
										onToggle={() =>
											setExpandedSkill(
												expandedSkill === getSkillKey(skill) ? null : getSkillKey(skill),
											)
										}
										onEdit={() => handleOpenFile(skill.name)}
										onDelete={() => setDeleteConfirm(getSkillKey(skill))}
										deleteConfirm={deleteConfirm === getSkillKey(skill)}
										onDeleteConfirm={() => handleDelete(skill.name, skill.source)}
										onDeleteCancel={() => setDeleteConfirm(null)}
										t={t}
									/>
								))}
							</div>
						)}

						{/* Global Skills */}
						{globalSkills.length > 0 && (
							<div>
								<div
									className="text-sm"
									style={{
										fontWeight: 500,
										color: "var(--vscode-descriptionForeground)",
										marginBottom: "8px",
									}}>
									{t("skills:globalSkills")}
								</div>
								{globalSkills.map((skill) => (
									<SkillRow
										key={getSkillKey(skill)}
										skill={skill}
										isExpanded={expandedSkill === getSkillKey(skill)}
										onToggle={() =>
											setExpandedSkill(
												expandedSkill === getSkillKey(skill) ? null : getSkillKey(skill),
											)
										}
										onEdit={() => handleOpenFile(skill.name)}
										onDelete={() => setDeleteConfirm(getSkillKey(skill))}
										deleteConfirm={deleteConfirm === getSkillKey(skill)}
										onDeleteConfirm={() => handleDelete(skill.name, skill.source)}
										onDeleteCancel={() => setDeleteConfirm(null)}
										t={t}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</Section>

			{/* Create Dialog */}
			{showCreateDialog && (
				<CreateSkillDialog onClose={() => setShowCreateDialog(false)} onCreate={handleCreate} />
			)}
		</div>
	)
}

interface SkillRowProps {
	skill: SkillMetadata
	isExpanded: boolean
	onToggle: () => void
	onEdit: () => void
	onDelete: () => void
	deleteConfirm: boolean
	onDeleteConfirm: () => void
	onDeleteCancel: () => void
	t: (key: string, options?: Record<string, any>) => string
}

const SkillRow = ({
	skill,
	isExpanded,
	onToggle,
	onEdit,
	onDelete,
	deleteConfirm,
	onDeleteConfirm,
	onDeleteCancel,
	t,
}: SkillRowProps) => {
	return (
		<div style={{ marginBottom: "10px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					padding: "8px",
					background: "var(--vscode-textCodeBlock-background)",
					cursor: "pointer",
					borderRadius: isExpanded ? "4px 4px 0 0" : "4px",
				}}
				onClick={onToggle}>
				<span
					className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
					style={{ marginRight: "8px" }}
				/>
				<div style={{ flex: 1, minWidth: 0 }}>
					<span style={{ fontWeight: 500 }}>{skill.name}</span>
					{skill.description && (
						<span
							className="text-sm"
							style={{
								marginLeft: "8px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							{skill.description}
						</span>
					)}
				</div>
				{skill.mode && (
					<span
						className="text-xs"
						style={{
							marginLeft: "8px",
							padding: "1px 6px",
							borderRadius: "4px",
							background: "var(--vscode-badge-background)",
							color: "var(--vscode-badge-foreground)",
						}}>
						{skill.mode}
					</span>
				)}
				<span
					className="text-xs"
					style={{
						marginLeft: "8px",
						padding: "1px 6px",
						borderRadius: "4px",
						background: "var(--vscode-badge-background)",
						color: "var(--vscode-badge-foreground)",
					}}>
					{skill.source}
				</span>
				<div
					style={{ display: "flex", alignItems: "center", marginLeft: "8px" }}
					onClick={(e) => e.stopPropagation()}>
					<Button variant="ghost" size="icon" onClick={onEdit} style={{ marginRight: "4px" }}>
						<span className="codicon codicon-edit" style={{ fontSize: "14px" }}></span>
					</Button>
					<Button variant="ghost" size="icon" onClick={onDelete}>
						<span className="codicon codicon-trash" style={{ fontSize: "14px" }}></span>
					</Button>
				</div>
			</div>

			{isExpanded && (
				<div
					style={{
						background: "var(--vscode-textCodeBlock-background)",
						padding: "10px",
						borderRadius: "0 0 4px 4px",
					}}>
					<div style={{ marginBottom: "8px" }}>
						<strong>Path:</strong>{" "}
						<span style={{ color: "var(--vscode-descriptionForeground)" }}>{skill.path}</span>
					</div>
					{skill.mode && (
						<div style={{ marginBottom: "8px" }}>
							<strong>Mode:</strong>{" "}
							<span style={{ color: "var(--vscode-descriptionForeground)" }}>{skill.mode}</span>
						</div>
					)}
					<Button variant="secondary" onClick={onEdit} style={{ width: "100%" }}>
						<span className="codicon codicon-edit" style={{ marginRight: "6px" }}></span>
						{t("skills:row.edit")}
					</Button>
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteConfirm} onOpenChange={onDeleteCancel}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("skills:deleteDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("skills:deleteDialog.description", { name: skill.name })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="secondary" onClick={onDeleteCancel}>
							{t("skills:deleteDialog.cancel")}
						</Button>
						<Button variant="primary" onClick={onDeleteConfirm}>
							{t("skills:deleteDialog.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

interface CreateSkillDialogProps {
	onClose: () => void
	onCreate: (values: {
		name: string
		description: string
		source: string
		mode?: string
		instructions?: string
	}) => void
}

const CreateSkillDialog = ({ onClose, onCreate }: CreateSkillDialogProps) => {
	const { t } = useAppTranslation()
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [source, setSource] = useState<"project" | "global">("project")
	const [mode, setMode] = useState("")
	const [instructions, setInstructions] = useState("")

	const isValid = name.trim().length > 0 && description.trim().length > 0

	const handleSubmit = () => {
		if (!isValid) return
		onCreate({
			name: name.trim(),
			description: description.trim(),
			source,
			mode: mode.trim() || undefined,
			instructions: instructions.trim() || undefined,
		})
	}

	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("skills:createDialog.title")}</DialogTitle>
				</DialogHeader>
				<div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "4px 0" }}>
					{/* Name */}
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontWeight: 500,
							}}>
							{t("skills:createDialog.name")}
						</label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("skills:createDialog.namePlaceholder")}
						/>
						<div
							className="text-xs"
							style={{
								color: "var(--vscode-descriptionForeground)",
								marginTop: "4px",
							}}>
							{t("skills:createDialog.nameHelp")}
						</div>
					</div>

					{/* Description */}
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontWeight: 500,
							}}>
							{t("skills:createDialog.description")}
						</label>
						<Input
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={t("skills:createDialog.descriptionPlaceholder")}
						/>
					</div>

					{/* Source */}
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontWeight: 500,
							}}>
							{t("skills:createDialog.source")}
						</label>
						<div style={{ display: "flex", gap: "12px" }}>
							<label
								style={{
									display: "flex",
									alignItems: "center",
									gap: "6px",
									cursor: "pointer",
								}}>
								<input
									type="radio"
									name="skill-source"
									checked={source === "project"}
									onChange={() => setSource("project")}
								/>
								{t("skills:createDialog.sourceProject")}
							</label>
							<label
								style={{
									display: "flex",
									alignItems: "center",
									gap: "6px",
									cursor: "pointer",
								}}>
								<input
									type="radio"
									name="skill-source"
									checked={source === "global"}
									onChange={() => setSource("global")}
								/>
								{t("skills:createDialog.sourceGlobal")}
							</label>
						</div>
					</div>

					{/* Mode (optional) */}
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontWeight: 500,
							}}>
							{t("skills:createDialog.mode")}
						</label>
						<Input
							value={mode}
							onChange={(e) => setMode(e.target.value)}
							placeholder={t("skills:createDialog.modePlaceholder")}
						/>
						<div
							className="text-xs"
							style={{
								color: "var(--vscode-descriptionForeground)",
								marginTop: "4px",
							}}>
							{t("skills:createDialog.modeHelp")}
						</div>
					</div>

					{/* Instructions (optional) */}
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontWeight: 500,
							}}>
							{t("skills:createDialog.instructions")}
						</label>
						<Textarea
							value={instructions}
							onChange={(e) => setInstructions(e.target.value)}
							placeholder={t("skills:createDialog.instructionsPlaceholder")}
							rows={4}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="secondary" onClick={onClose}>
						{t("skills:createDialog.cancel")}
					</Button>
					<Button variant="primary" onClick={handleSubmit} disabled={!isValid}>
						{t("skills:createDialog.create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default SkillsView
