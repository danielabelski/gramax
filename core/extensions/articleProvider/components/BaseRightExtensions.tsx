import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import EditMarkdownTrigger from "@ext/article/actions/EditMarkdownTrigger";
import type { ArticleProviderType } from "@ext/articleProvider/logic/ArticleProvider";
import DeleteItem from "@ext/item/actions/DeleteItem";
import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { MenuItemIconButton } from "@ui-kit/MenuItem";
import { type ReactNode, useCallback, useState } from "react";

interface DeleteItemProps {
	id: string;
	providerType: ArticleProviderType;
	confirmDeleteText?: string;
	onDelete: (id: string) => void;
	preDelete?: (id: string) => Promise<boolean>;
}

interface BaseRightExtensionsProps extends DeleteItemProps {
	items?: (id: string) => ReactNode;
	onMarkdownChange: (id: string, markdown: string) => void;
	onEdit?: () => void;
	onOpenChange?: (open: boolean) => void;
}

const Delete = ({ id, onDelete, providerType, preDelete, confirmDeleteText }: DeleteItemProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;

	const onConfirm = async () => {
		if (preDelete && !(await preDelete(id))) return;
		if (!preDelete && !(await confirm(confirmDeleteText || t("article.actions.delete.article.title")))) return;

		await FetchService.fetch(apiUrlCreator.removeFileInGramaxDir(id, providerType));
		onDelete(id);
	};

	return <DeleteItem onConfirm={onConfirm} />;
};

const BaseRightExtensions = (props: BaseRightExtensionsProps) => {
	const { id, onDelete, onEdit, onMarkdownChange, items, providerType, preDelete, confirmDeleteText, onOpenChange } =
		props;
	const apiUrlCreator = ApiUrlCreatorService.value;
	const [isOpen, setIsOpen] = useState<boolean>(false);

	const setOpen = useCallback(
		(open: boolean) => {
			setIsOpen(open);
			onOpenChange?.(open);
		},
		[onOpenChange],
	);

	const loadContent = useCallback(async () => {
		const res = await FetchService.fetch(apiUrlCreator.getFileContentInGramaxDir(id, providerType));
		if (res.ok) return await res.json();
	}, [id, providerType]);

	const saveContent = useCallback(
		async (content: string) => {
			const body = JSON.stringify({ content });
			await FetchService.fetch(apiUrlCreator.updateFileInGramaxDir(id, providerType), body);

			onMarkdownChange(id, content);
		},
		[id, onMarkdownChange, providerType],
	);

	return (
		<DropdownMenu onOpenChange={setOpen} open={isOpen}>
			<DropdownMenuTrigger asChild>
				<MenuItemIconButton
					icon="ellipsis"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setOpen(!isOpen);
					}}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{onEdit && (
					<DropdownMenuItem onSelect={onEdit}>
						<Icon icon="pencil" />
						{t("edit2")}
					</DropdownMenuItem>
				)}
				<EditMarkdownTrigger
					isCurrentItem
					isTemplate={false}
					loadContent={loadContent}
					saveContent={saveContent}
				/>
				{items?.(id)}
				<Delete
					confirmDeleteText={confirmDeleteText}
					id={id}
					onDelete={onDelete}
					preDelete={preDelete}
					providerType={providerType}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default BaseRightExtensions;
