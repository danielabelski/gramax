import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { useSidebarGroupOpen } from "@ext/enterprise/components/admin/hooks/useSidebarGroupOpen";
import { AdminSidebarMenuSubButton } from "@ext/enterprise/components/admin/sidebar/AdminSidebarMenuSubButton";
import { Button } from "@ui-kit/Button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@ui-kit/Collapsible";
import { Icon } from "@ui-kit/Icon";
import {
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
} from "@ui-kit/Sidebar";

type SidebarItemType = "button" | "title";

type BaseSidebarItem = { type: SidebarItemType; key: string; label: string; shouldShow?: () => boolean };

export type SidebarButtonItem = BaseSidebarItem & { type: "button"; icon: IconCode; children?: SidebarButtonItem[] };

type SidebarTitle = BaseSidebarItem & { type: "title"; icon?: undefined };

export type SidebarItem = BaseSidebarItem & (SidebarButtonItem | SidebarTitle);

type AppSettingsSidebarTabsRendererProps = {
	items: SidebarItem[];
	active: string;
	onChange: (key: string) => void;
};

type SidebarTabsGroupProps = {
	item: SidebarButtonItem;
	active: string;
	onChange: (key: string) => void;
};

const SidebarTabsGroup = ({ item, active, onChange }: SidebarTabsGroupProps) => {
	const children = item.children ?? [];
	const targetKey = children[0]?.key ?? item.key;
	const containsActive = children.some((child) => child.key === active);
	const { open, setOpen, onItemClick } = useSidebarGroupOpen(containsActive, active === targetKey);

	return (
		<Collapsible className="group/sidebar-menu" onOpenChange={setOpen} open={open}>
			<SidebarMenuItem>
				<SidebarMenuButton
					className="[&>svg]:hover:text-primary-fg"
					onClick={() => {
						onItemClick();
						onChange(targetKey);
					}}
				>
					<Icon icon={item.icon} />
					<span>{item.label}</span>
					<CollapsibleTrigger asChild>
						<Button
							aria-label="Toggle section"
							className="size-3.5 p-0"
							onClick={(e) => e.stopPropagation()}
							size="sm"
							variant="text"
						>
							<Icon
								className="!w-3 !h-3 stroke-[2.5] transition-transform group-data-[state=open]/sidebar-menu:rotate-90"
								icon="chevron-right"
							/>
						</Button>
					</CollapsibleTrigger>
				</SidebarMenuButton>
			</SidebarMenuItem>
			<CollapsibleContent className="overflow-visible data-[state=closed]:overflow-hidden">
				<SidebarMenuSub className="border-none">
					{children.map((child) => (
						<SidebarMenuSubItem key={child.key}>
							<AdminSidebarMenuSubButton
								className="!no-underline"
								isActive={active === child.key}
								onClick={(e) => {
									e.preventDefault();
									onChange(child.key);
								}}
							>
								<Icon icon={child.icon} />
								<span>{child.label}</span>
							</AdminSidebarMenuSubButton>
						</SidebarMenuSubItem>
					))}
				</SidebarMenuSub>
			</CollapsibleContent>
		</Collapsible>
	);
};

export const AppSettingsSidebarTabsRenderer = ({ items, active, onChange }: AppSettingsSidebarTabsRendererProps) => (
	<SidebarMenu className="gap-0.5">
		{items.map((item) =>
			item.type === "button" ? (
				item.children ? (
					<SidebarTabsGroup active={active} item={item} key={item.key} onChange={onChange} />
				) : (
					<SidebarMenuItem key={item.key}>
						<SidebarMenuButton isActive={active === item.key} onClick={() => onChange(item.key)}>
							<Icon icon={item.icon} />
							<span>{item.label}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				)
			) : (
				<SidebarGroupLabel key={item.key}>
					<span>{item.label}</span>
				</SidebarGroupLabel>
			),
		)}
	</SidebarMenu>
);
