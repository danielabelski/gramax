import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import EditMarkdownTrigger from "@ext/article/actions/EditMarkdownTrigger";
import t from "@ext/localization/locale/translate";
import type { FragmentAlreadyUseWarnProps } from "@ext/markdown/elements/fragment/edit/components/FragmentAlreadyUseWarn";
import FragmentUpdateService from "@ext/markdown/elements/fragment/edit/components/FragmentUpdateService";
import FragmentService from "@ext/markdown/elements/fragment/edit/components/Tab/FragmentService";
import FragmentUsages from "@ext/markdown/elements/fragment/edit/components/Tab/FragmentUsages";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel/components/FloatingTriggerButton";
import { Icon } from "@ui-kit/Icon";
import type { MouseEvent } from "react";
import type { FragmentListItem } from "./types/constants";

type FragmentsActionsProps = {
	fragment: FragmentListItem;
	onRefresh: () => Promise<FragmentListItem[]>;
};

export const FragmentsActions = ({ fragment, onRefresh }: FragmentsActionsProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { selectedID } = FragmentService.value;

	const loadContent = async () => {
		const response = await FetchService.fetch(apiUrlCreator.getFileContentInGramaxDir(fragment.id, "fragment"));
		if (response.ok) return await response.json();
	};

	const saveContent = async (content: string) => {
		await FetchService.fetch(
			apiUrlCreator.updateFileInGramaxDir(fragment.id, "fragment"),
			JSON.stringify({ content }),
		);
		await FragmentUpdateService.updateContent(fragment.id, apiUrlCreator);
		await onRefresh();
	};

	const confirmDelete = () =>
		new Promise<boolean>((resolve) => {
			ModalToOpenService.setValue<FragmentAlreadyUseWarnProps>(ModalToOpen.FragmentAlreadyUseWarn, {
				fragmentId: fragment.id,
				onClose: () => {
					resolve(false);
					ModalToOpenService.resetValue();
				},
				onSubmit: () => {
					resolve(true);
					ModalToOpenService.resetValue();
				},
			});
		});

	const deleteFragment = async () => {
		if (!(await confirmDelete())) return;

		await FetchService.fetch(apiUrlCreator.removeFileInGramaxDir(fragment.id, "fragment"));
		if (selectedID === fragment.id) {
			void FetchService.fetch(apiUrlCreator.clearArticlesContentWithFragment(fragment.id));
			FragmentService.closeItem();
		}
		FragmentUpdateService.clearContent(fragment.id);
		await onRefresh();
	};

	const stopRowClick = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

	return (
		<div onClick={stopRowClick}>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<FloatingTriggerButton
						aria-label={t("actions")}
						className="opacity-0 transition-opacity group-hover/fragment:opacity-100 data-[state=open]:opacity-100"
					>
						<Icon icon="ellipsis" />
					</FloatingTriggerButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<EditMarkdownTrigger
						isCurrentItem
						isTemplate={false}
						loadContent={loadContent}
						saveContent={saveContent}
					/>
					<FragmentUsages
						fragmentId={fragment.id}
						isSubmenu
						trigger={
							<>
								<Icon icon="file-symlink" />
								{t("view-usage")}
							</>
						}
					/>
					<DropdownMenuItem onSelect={() => void deleteFragment()} type="danger">
						<Icon icon="trash" />
						{t("delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
