import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import {
	DropdownEmpty,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSearchItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	useSearchableMenu,
} from "@ui-kit/Dropdown";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { Loader } from "@ui-kit/Loader";
import { useCallback, useMemo, useState } from "react";

interface FragmentLinkMenuButtonProps {
	editor: Editor;
}

const FragmentLinkMenuButton = ({ editor }: FragmentLinkMenuButtonProps) => {
	const { disabled, isActive } = ButtonStateService.useCurrentAction({ mark: "fragment-link" });
	const [isOpen, setIsOpen] = useState(false);
	const [fragmentsList, setFragmentsList] = useState<ProviderItemProps[]>([]);

	const { call: getFragments, status } = useApi<ProviderItemProps[]>({
		url: (api) => api.getArticleListInGramaxDir("fragment"),
		onDone: (data) => setFragmentsList(data),
		parse: "json",
	});

	const { search, setSearch, contentRef, inputRef, handleContentKeyDown, handleInputKeyDown, filterItems } =
		useSearchableMenu();

	const onItemSelect = useCallback(
		(fragment: ProviderItemProps) => {
			editor.chain().focus().setFragmentLink({ id: fragment.id }).run();
			setIsOpen(false);
		},
		[editor],
	);

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				setSearch("");
				setIsOpen(false);
				return;
			}

			if (isActive) {
				editor.chain().focus().unsetFragmentLink().run();
				return;
			}

			if (status !== RequestStatus.Loading) getFragments();
			setIsOpen(true);
		},
		[isActive, editor, status, getFragments, setSearch],
	);

	const onCloseAutoFocus = useCallback((event: Event) => {
		event.preventDefault();
	}, []);

	const filteredFragments = useMemo(
		() => filterItems(fragmentsList.map((fragment) => ({ ...fragment, label: fragment.title }))),
		[fragmentsList, filterItems],
	);

	return (
		<DropdownMenu modal={false} onOpenChange={onOpenChange} open={isOpen}>
			<DropdownMenuTrigger asChild>
				<GlassToolbarToggleButton
					active={isActive || isOpen}
					data-qa="fragment-link-button"
					disabled={disabled}
					tooltipText={t("fragment-link")}
				>
					<GlassToolbarIcon icon="square-dashed-bottom" />
				</GlassToolbarToggleButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				alignOffset={-18}
				className="w-72 max-h-[min(18.75rem,60vh)]"
				onCloseAutoFocus={onCloseAutoFocus}
				onKeyDown={handleContentKeyDown}
				ref={contentRef}
				side="top"
				sideOffset={8}
			>
				<DropdownMenuSearchItem
					onChange={(e) => setSearch(e.target.value)}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={handleInputKeyDown}
					placeholder={`${t("find2")} ${t("fragment").toLowerCase()}`}
					ref={inputRef}
					value={search}
				/>
				<DropdownMenuSeparator />
				<div className="max-h-44 overflow-y-auto text-xs">
					{status !== RequestStatus.Ready ? (
						<DropdownMenuItem disabled>
							<div className="flex items-center gap-2">
								<Loader size="sm" />
								<span className="text-xs">{t("loading")}</span>
							</div>
						</DropdownMenuItem>
					) : filteredFragments.length === 0 ? (
						<DropdownEmpty>{t("list.no-results-found")}</DropdownEmpty>
					) : (
						filteredFragments.map((fragment) => (
							<DropdownMenuItem
								key={fragment.id}
								onSelect={() => onItemSelect(fragment)}
								textValue={fragment.title}
							>
								<span className="text-xs truncate" data-fragment-id={fragment.id}>
									{fragment.title}
								</span>
							</DropdownMenuItem>
						))
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default FragmentLinkMenuButton;
