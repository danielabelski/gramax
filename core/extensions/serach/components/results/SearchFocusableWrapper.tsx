import Link from "@components/Atoms/Link";
import type Url from "@core-ui/ApiServices/Types/Url";
import { cn } from "@core-ui/utils/cn";
import { searchLinkClick } from "@ext/serach/components/utils/searchLinkClick";
import type { FocusItem } from "@ext/serach/utils/FocusItemsCollector";
import type { SearchItemRowId } from "@ext/serach/utils/SearchRowsModel";

export interface SearchFocusableWrapperProps {
	item: {
		id: SearchItemRowId;
		focusable: boolean;
	};
	url?: Url;
	onClick: () => void;
	onLinkOver: (id: SearchItemRowId) => void;
	onFocus: (id: SearchItemRowId) => void;
	focusItem: FocusItem | undefined;
	focusRef: React.RefObject<HTMLElement>;
	children: React.ReactNode;
}

export const SearchFocusableWrapper = (props: SearchFocusableWrapperProps) => {
	const { item, url, onFocus, onLinkOver, focusItem, focusRef, children, onClick } = props;
	const { id, focusable } = item;
	const isFocused = focusItem?.id === id;

	if (!focusable)
		return <div ref={isFocused ? (focusRef as React.RefObject<HTMLDivElement>) : undefined}>{children}</div>;

	const focusHandlers = {
		onFocus: () => onFocus(id),
		onMouseOver: (e: React.MouseEvent) => {
			onLinkOver(id);
			e.stopPropagation();
		},
	};

	if (url)
		return (
			<Link
				className={cn("block rounded-md text-inherit", isFocused && "bg-secondary-bg-hover")}
				href={url}
				onClick={searchLinkClick(onClick)}
				ref={isFocused ? (focusRef as React.RefObject<HTMLAnchorElement>) : undefined}
				tabIndex={-1}
				{...focusHandlers}
			>
				{children}
			</Link>
		);

	return (
		<div
			className={cn("cursor-pointer rounded-md", isFocused && "bg-secondary-bg-hover")}
			onClick={(e) => {
				const link = (e.target as HTMLElement).closest("a");
				if (link && e.currentTarget.contains(link)) return;
				e.preventDefault();
				onClick();
			}}
			ref={isFocused ? (focusRef as React.RefObject<HTMLDivElement>) : undefined}
			{...focusHandlers}
		>
			{children}
		</div>
	);
};
