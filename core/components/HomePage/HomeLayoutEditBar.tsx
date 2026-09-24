import t from "@ext/localization/locale/translate";
import { Button, LoadingButtonTemplate } from "@ui-kit/Button";
import { Divider } from "@ui-kit/Divider";
import { Icon } from "@ui-kit/Icon";
import type { HomeLayoutEditScope } from "./utils/homeLayoutTypes";

interface HomeLayoutEditBarProps {
	scope: HomeLayoutEditScope;
	onCancel: () => void;
	onSave: () => void;
	onAddSection?: () => void;
	isSaving?: boolean;
}

const HomeLayoutEditBar = ({ scope, onCancel, onSave, onAddSection, isSaving = false }: HomeLayoutEditBarProps) => {
	const title = scope === "personal" ? t("editing-personal-homepage-view") : t("editing-shared-homepage-view");
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-4 z-[var(--z-index-toolbar)] flex justify-center px-4">
			<div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-2xl bg-inverse-primary-bg py-2 pr-2 pl-4 text-inverse-primary-fg shadow-hard-base">
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<Icon
						className=" shrink-0 text-inverse-muted"
						icon={scope === "personal" ? "user-round" : "users"}
						size="sm"
					/>
					<span className="truncate text-xs font-medium">{title}</span>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<div className="flex items-center gap-1">
						<Divider className="h-5 bg-inverse-border max-[520px]:hidden" orientation="vertical" />
					</div>

					<div className="flex items-center gap-3">
						<Button
							className="!bg-transparent !text-inverse-secondary-fg hover:!bg-inverse-hover hover:!text-inverse-primary-fg"
							disabled={!onAddSection || isSaving}
							onClick={onAddSection}
							size="xs"
							startIcon="plus"
							variant="ghost"
						>
							{t("add-section")}
						</Button>
						<Button
							className="!bg-transparent !text-inverse-secondary-fg hover:!bg-inverse-hover hover:!text-inverse-primary-fg"
							disabled={isSaving}
							onClick={onCancel}
							size="xs"
							variant="ghost"
						>
							{t("cancel")}
						</Button>
						{isSaving ? (
							<LoadingButtonTemplate
								className="[&>div]:flex-row-reverse !bg-[hsl(var(--inverse-accent))] !text-[hsl(var(--inverse-accent-text))]"
								size="xs"
								text={t("save")}
							/>
						) : (
							<Button
								className="!bg-[hsl(var(--inverse-accent))] !text-[hsl(var(--inverse-accent-text))] hover:!bg-[hsl(var(--inverse-accent-hover))]"
								onClick={onSave}
								size="xs"
							>
								{t("save")}
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default HomeLayoutEditBar;
