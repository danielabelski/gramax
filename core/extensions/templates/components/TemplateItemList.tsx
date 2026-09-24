import Icon from "@components/Atoms/Icon";
import type { ClientArticleProps } from "@core/SitePresenter/SitePresenter";
import FetchService from "@core-ui/ApiServices/FetchService";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import type { TemplateContentWarningProps } from "@ext/templates/components/TemplateContentWarning";
import { TEMPLATES_PANEL_ID } from "@ext/templates/components/TemplatesPanel/types/constants";
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
import { Loader } from "@ui-kit/Loader";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { useCallback, useMemo, useRef, useState } from "react";

const TemplateItemList = ({ itemRefPath }: { itemRefPath: string }) => {
	const [list, setList] = useState<ProviderItemProps[]>([]);
	const triggerRef = useRef<HTMLDivElement>(null);
	const { toggle } = usePanelToggle(TEMPLATES_PANEL_ID, triggerRef);
	const isMobile = useMediaQuery(cssMedia.JSnarrow);

	const { call: fetchTemplateItems, status } = useApi<ProviderItemProps[]>({
		url: (api) => api.getArticleListInGramaxDir("template"),
		onDone: (data) => setList(data),
		parse: "json",
	});

	const { call: getArticleContent } = useApi<string>({
		url: (api) => api.getArticleContent(itemRefPath),
	});

	const { call: getItemProps } = useApi<ClientArticleProps>({
		url: (api) => api.getItemProps(itemRefPath),
	});

	const apiUrlCreator = ApiUrlCreatorService.value;

	const setModalLoader = useCallback(() => {
		ModalToOpenService.setValue(ModalToOpen.Loading);
	}, []);

	const setAsTemplate = useCallback(
		async (item: ProviderItemProps) => {
			setModalLoader();
			const itemProps = await getItemProps();
			if (!itemProps) return ModalToOpenService.resetValue();

			itemProps.template = item.id;
			itemProps.title = itemProps.title !== t("article.no-name") ? itemProps.title : "";

			const setArticleContentUrl = apiUrlCreator.setArticleContent(itemRefPath);
			await FetchService.fetch(setArticleContentUrl, "");

			const url = apiUrlCreator.updateItemProps();
			await FetchService.fetch(url, JSON.stringify(itemProps), MimeTypes.json);

			ModalToOpenService.resetValue();
			await refreshPage();
		},
		[itemRefPath, getItemProps, setModalLoader],
	);

	const onSelectHandler = useCallback(
		async (item: ProviderItemProps) => {
			const content = await getArticleContent();
			const isHasContent = content?.length > 0;

			if (isHasContent) {
				ModalToOpenService.setValue<TemplateContentWarningProps>(ModalToOpen.TemplateContentWarning, {
					initialIsOpen: true,
					templateName: item.title,
					action: () => {
						void setAsTemplate(item);
					},
					onClose: () => {
						ModalToOpenService.resetValue();
					},
				});
			} else {
				await setAsTemplate(item);
			}
		},
		[getArticleContent, setAsTemplate],
	);

	const { search, setSearch, contentRef, inputRef, handleContentKeyDown, handleInputKeyDown, filterItems } =
		useSearchableMenu();

	const filteredTemplates = useMemo(
		() => filterItems(list.map((template) => ({ ...template, label: template.title ?? "" }))),
		[list, filterItems],
	);

	const onOpen = useCallback(
		(open: boolean) => {
			if (!open) return setSearch("");
			if (status !== RequestStatus.Loading) fetchTemplateItems();
		},
		[fetchTemplateItems, setSearch, status],
	);

	const isReady = status === RequestStatus.Ready;
	const hasTemplates = list.length > 0;

	return (
		<DropdownMenuSub onOpenChange={onOpen}>
			<DropdownMenuSubTrigger>
				<div className="flex items-center gap-2" data-testid="templates-menu">
					<Icon code="layout-template" />
					{t("template.choose-template")}
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
					onChange={(event) => setSearch(event.target.value)}
					onClick={(event) => event.stopPropagation()}
					onKeyDown={handleInputKeyDown}
					placeholder={`${t("find2")} ${t("template.name").toLowerCase()}`}
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
					) : hasTemplates ? (
						filteredTemplates.length === 0 ? (
							<DropdownEmpty>{t("list.no-results-found")}</DropdownEmpty>
						) : (
							filteredTemplates.map((item) => (
								<DropdownMenuItem
									key={item.id}
									onSelect={() => void onSelectHandler(item)}
									textValue={item.title ?? ""}
								>
									<TextOverflowTooltip className="block w-full min-w-0 flex-1">
										{item.title || t("article.no-name")}
									</TextOverflowTooltip>
								</DropdownMenuItem>
							))
						)
					) : (
						<DropdownMenuItem disabled>{t("template.no-templates")}</DropdownMenuItem>
					)}
				</div>
				<div className="mt-auto">
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={toggle} textValue="manage-templates">
						<div className="flex items-center gap-2" data-testid="manage-templates" ref={triggerRef}>
							<Icon code="layout-template" />
							{t("templates-panel-manage")}
						</div>
					</DropdownMenuItem>
				</div>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
};

export default TemplateItemList;
