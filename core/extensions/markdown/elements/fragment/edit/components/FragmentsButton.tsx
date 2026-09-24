import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import BaseRightExtensions from "@ext/articleProvider/components/BaseRightExtensions";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import type { FragmentAlreadyUseWarnProps } from "@ext/markdown/elements/fragment/edit/components/FragmentAlreadyUseWarn";
import { FRAGMENTS_PANEL_ID } from "@ext/markdown/elements/fragment/edit/components/FragmentsPanel/types/constants";
import FragmentUpdateService from "@ext/markdown/elements/fragment/edit/components/FragmentUpdateService";
import FragmentService from "@ext/markdown/elements/fragment/edit/components/Tab/FragmentService";
import FragmentUsages from "@ext/markdown/elements/fragment/edit/components/Tab/FragmentUsages";
import type { FragmentRenderData } from "@ext/markdown/elements/fragment/edit/model/types";
import type { Editor } from "@tiptap/core";
import {
	DropdownEmpty,
	DropdownMenuItem,
	DropdownMenuSearchItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	useSearchableMenu,
} from "@ui-kit/Dropdown";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { Loader } from "@ui-kit/Loader";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useCallback, useMemo, useRef, useState } from "react";

interface FragmentsButtonProps {
	editor: Editor;
}

const FragmentsButton = ({ editor }: FragmentsButtonProps) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const [fragmentsList, setFragmentsList] = useState<ProviderItemProps[]>([]);
	const reopenFragmentIdRef = useRef<string>(null);
	const { selectedID } = FragmentService.value;
	const panelTriggerRef = useRef<HTMLDivElement>(null);
	const { toggle: toggleFragmentsPanel } = usePanelToggle(FRAGMENTS_PANEL_ID, panelTriggerRef);
	const isMobile = useMediaQuery(cssMedia.JSnarrow);

	const { call: getFragments, status } = useApi<ProviderItemProps[]>({
		url: (api) => api.getArticleListInGramaxDir("fragment"),
		onDone: (data) => {
			setFragmentsList(data);
			FragmentService.setItems(data);

			const fragmentId = reopenFragmentIdRef.current;
			if (!fragmentId) return;
			reopenFragmentIdRef.current = null;
			const fragment = data.find((item) => item.id === fragmentId);
			if (fragment) FragmentService.openItem(fragment);
		},
		parse: "json",
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: it's ok
	const onItemSelect = useCallback(
		async (fragment: ProviderItemProps) => {
			const res = await FetchService.fetch<FragmentRenderData>(apiUrlCreator.getFragmentRenderData(fragment.id));
			if (!res.ok) return;

			const data = await res.json();
			editor.chain().setFragment(data).focus(editor.state.selection.anchor).run();
		},
		[editor, apiUrlCreator],
	);

	const { disabled } = ButtonStateService.useCurrentAction({ action: "fragment" });

	const onEditClick = useCallback((fragment: ProviderItemProps) => {
		FragmentService.openItem(fragment);
	}, []);

	const onDelete = useCallback(
		(id: string) => {
			if (selectedID === id) {
				void FetchService.fetch(apiUrlCreator.clearArticlesContentWithFragment(id));
				FragmentService.closeItem();
			}

			setFragmentsList((items) => {
				const nextItems = items.filter((item) => item.id !== id);
				FragmentService.setItems(nextItems);
				return nextItems;
			});
			FragmentUpdateService.clearContent(id);
		},
		[selectedID],
	);

	const onMarkdownChange = useCallback(
		async (id: string) => {
			await FragmentUpdateService.updateContent(id, apiUrlCreator);
			if (selectedID === id) {
				reopenFragmentIdRef.current = id;
				FragmentService.closeItem();
			}
			getFragments();
		},
		[selectedID, getFragments],
	);

	const preDelete = useCallback(async (id: string) => {
		return new Promise<boolean>((resolve) => {
			ModalToOpenService.setValue<FragmentAlreadyUseWarnProps>(ModalToOpen.FragmentAlreadyUseWarn, {
				fragmentId: id,
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
	}, []);
	const { search, setSearch, contentRef, inputRef, handleContentKeyDown, handleInputKeyDown, filterItems } =
		useSearchableMenu();

	const onOpenChange = useCallback(
		(open: boolean) => {
			if (!open) return setSearch("");
			if (status !== RequestStatus.Loading) getFragments();
		},
		[getFragments, status, setSearch],
	);

	const filteredFragments = useMemo(
		() => filterItems(fragmentsList.map((fragment) => ({ ...fragment, label: fragment.title }))),
		[fragmentsList, filterItems],
	);

	const isReady = status === RequestStatus.Ready;
	const hasFragments = fragmentsList.length > 0;

	return (
		<DropdownMenuSub onOpenChange={onOpenChange}>
			<DropdownMenuSubTrigger disabled={disabled}>
				<div className="flex items-center gap-2" data-qa="qa-fragments" data-testid="fragments-menu">
					<Icon icon="square-dashed-bottom" />
					{t("fragments")}
				</div>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent
				alignOffset={!isMobile ? -18 : 0}
				className="max-w-[min(20rem,var(--radix-dropdown-menu-content-available-width,100%))]"
				onKeyDown={handleContentKeyDown}
				ref={contentRef}
				sideOffset={!isMobile ? 2 : 6}
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
				<div className="flex-1 max-h-44 overflow-y-auto">
					{!isReady ? (
						<DropdownMenuItem disabled>
							<div className="flex items-center gap-2">
								<Loader size="sm" />
								{t("loading")}
							</div>
						</DropdownMenuItem>
					) : (
						hasFragments &&
						(filteredFragments.length === 0 ? (
							<DropdownEmpty>{t("list.no-results-found")}</DropdownEmpty>
						) : (
							filteredFragments.map((fragment) => (
								<DropdownMenuItem
									key={fragment.id}
									onSelect={() => void onItemSelect(fragment)}
									textValue={fragment.title}
								>
									<TextOverflowTooltip className="block w-full min-w-0 flex-1">
										{fragment.title}
									</TextOverflowTooltip>
									<BaseRightExtensions
										id={fragment.id}
										items={(id) => (
											<FragmentUsages
												fragmentId={id}
												isSubmenu
												trigger={
													<>
														<Icon icon="file-symlink" />
														{t("view-usage")}
													</>
												}
											/>
										)}
										onDelete={onDelete}
										onEdit={() => onEditClick(fragment)}
										onMarkdownChange={onMarkdownChange}
										preDelete={preDelete}
										providerType="fragment"
									/>
								</DropdownMenuItem>
							))
						))
					)}
				</div>
				<div className="mt-auto">
					{hasFragments && <DropdownMenuSeparator />}
					<DropdownMenuItem onSelect={toggleFragmentsPanel} textValue="manage-fragments">
						<div className="flex items-center gap-2" data-testid="manage-fragments" ref={panelTriggerRef}>
							<Icon icon="settings" />
							{t("fragments-panel-manage")}
						</div>
					</DropdownMenuItem>
				</div>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
};

export default FragmentsButton;
