import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { cssMedia } from "@core-ui/utils/cssUtils";
import { AiToolbarButton } from "@ext/ai/components/Helpers/AiToolbarButton";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuEmptyItem,
	DropdownMenuItem,
	DropdownMenuSearchItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	useSearchableMenu,
} from "@ui-kit/Dropdown";
import { GlassToolbar, GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { AutogrowTextarea } from "@ui-kit/Textarea";
import {
	type ChangeEvent,
	type Dispatch,
	type KeyboardEvent,
	memo,
	type SetStateAction,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface AiWritingPanelProps {
	placeholder: string;
	setOpen: Dispatch<SetStateAction<boolean>>;
	onSubmit: (command: string) => void;
	closeHandler?: () => void;
}

interface PromptListProps {
	onClick: (command: string) => void;
}

const PromptList = ({ onClick }: PromptListProps) => {
	const [list, setList] = useState<ProviderItemProps[]>([]);
	const [open, setOpen] = useState(false);
	const [height, setHeight] = useState<string>(null);
	const isMobile = useMediaQuery(cssMedia.JSnarrow);

	const { call: getPrompts, status } = useApi<ProviderItemProps[]>({
		url: (api) => api.getArticleListInGramaxDir("prompt"),
		onDone: (data) => setList(data),
	});

	const onOpenChange = (open: boolean) => {
		setOpen(open);
		if (open && status === RequestStatus.Init) getPrompts();
	};

	const { search, setSearch, contentRef, inputRef, handleContentKeyDown, handleInputKeyDown, filterItems } =
		useSearchableMenu();

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useLayoutEffect(() => {
		if (!open) return;
		const measure = () => {
			const subContent = contentRef.current;
			if (subContent) {
				setHeight(`${subContent.offsetHeight}px`);
			}
		};
		requestAnimationFrame(measure);
	}, [open, list]);

	const filteredPrompts = useMemo(
		() => filterItems(list.map((prompt) => ({ ...prompt, label: prompt.title }))),
		[list, filterItems],
	);

	return (
		<ComponentVariantProvider variant="glass">
			<DropdownMenu onOpenChange={onOpenChange}>
				<DropdownMenuTrigger asChild>
					<GlassToolbarToggleButton
						active={open}
						className="flex-shrink-0"
						focusable
						tooltipText={t("ai.ai-prompts")}
					>
						<GlassToolbarIcon icon="list" />
					</GlassToolbarToggleButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					onKeyDown={handleContentKeyDown}
					ref={contentRef}
					side="top"
					sideOffset={!isMobile ? 8 : 0}
					style={{
						maxWidth: "calc(min(14rem, var(--radix-popover-content-available-width, 100%)))",
						height: !filteredPrompts.length ? "unset" : height,
						maxHeight: !filteredPrompts.length ? "unset" : height,
						overflowY: "auto",
						boxShadow: "none",
					}}
				>
					<DropdownMenuSearchItem
						onChange={(e) => setSearch(e.target.value)}
						onClick={(e) => e.stopPropagation()}
						onKeyDown={handleInputKeyDown}
						placeholder={t("search.placeholder")}
						ref={inputRef}
						value={search}
					/>
					<DropdownMenuSeparator />
					<div className="h-full" style={{ maxHeight: "11rem", overflowY: "auto" }}>
						{filteredPrompts.length === 0 ? (
							<DropdownMenuEmptyItem>{t("ai.no-prompts")}</DropdownMenuEmptyItem>
						) : (
							filteredPrompts.map((prompt) => (
								<DropdownMenuItem
									key={prompt.id}
									onClick={() => onClick(prompt.id)}
									textValue={prompt.title}
								>
									{prompt.title}
								</DropdownMenuItem>
							))
						)}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</ComponentVariantProvider>
	);
};

export const AiWritingPanel = memo(({ closeHandler, onSubmit, placeholder }: AiWritingPanelProps) => {
	const [disabled, setDisabled] = useState(true);
	const value = useRef<string>("");

	const onClick = useCallback(
		(command: string) => {
			onSubmit(command);
			closeHandler?.();
		},
		[onSubmit, closeHandler],
	);

	const onClickSend = useCallback(() => {
		if (!value.current?.length) return;
		onClick(value.current);
	}, [onClick]);

	const onInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		value.current = e.target.value;
		setDisabled(!e.target.value.length);
	}, []);

	const onEnter = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onClickSend();
		},
		[onClickSend],
	);

	return (
		<GlassToolbar>
			<div className="flex items-end gap-1 w-full">
				<AutogrowTextarea
					autoFocus
					className="!shadow-none !bg-transparent !border-none !p-0 flex-1 self-center !px-2"
					minRows={1}
					onInput={onInput}
					onKeyDown={onEnter}
					placeholder={placeholder}
				/>
				<PromptList onClick={onClick} />
				<AiToolbarButton
					className="flex-shrink-0"
					disabled={disabled}
					icon="arrow-up"
					onClick={onClickSend}
					tooltipText={t("send")}
				/>
			</div>
		</GlassToolbar>
	);
});
