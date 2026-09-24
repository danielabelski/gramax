// biome-ignore lint/style/noRestrictedImports: existing styled SidebarProvider wrapper
import styled from "@emotion/styled";
import type { CatalogSettingsModalProps } from "@ext/catalog/actions/propsEditor/logic/createFormSchema";
import ModalErrorHandler from "@ext/errorHandlers/client/components/ModalErrorHandler";
import type { AppSettingsTab } from "@ext/settings/logic/formSchema";
import { Level } from "@ext/settings/logic/settings";
import { Dialog, DialogClose, DialogContent } from "@ui-kit/Dialog";
import { Icon } from "@ui-kit/Icon";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarProvider,
} from "@ui-kit/Sidebar";
import type { ReactNode } from "react";

export interface AppSettingsEditorProps {
	defaultLevel?: Level;
	defaultAppTab?: AppSettingsTab;
	onClose?: () => void;
	/** Forwarded to the catalog body — callers like CatalogExistsError react to a successful catalog save. */
	onCatalogSubmit?: CatalogSettingsModalProps["onSubmit"];
	/** Extra DialogContent attributes (e.g. data-upper-error to stack above an error dialog). */
	modalContentProps?: Record<string, unknown>;
}

export const SidebarContainer = styled(SidebarProvider)`
	height: 100%;
	min-height: unset;
	max-height: 100%;
	overflow: hidden;

	ul {
		list-style: none !important;
	}

	li {
		line-height: unset;
		margin-bottom: unset;
	}
`;

export const parseLevel = (raw: string): Level | undefined => {
	const num = Number(raw);
	if (num === Level.app || num === Level.workspace || num === Level.catalog) return num;
	return undefined;
};

type AppSettingsEditorLayoutProps = {
	open: boolean;
	onDialogOpenChange: (next: boolean) => void;
	onClose: () => void;
	modalContentProps?: Record<string, unknown>;
	/** Names the level being configured — app, workspace or catalog. */
	title: string;
	/** App settings run at "L"; the workspace and catalog levels keep the default "M". */
	size?: "M" | "L";
	sidebarHeader?: ReactNode;
	sidebarTabs: ReactNode;
	mainContent: ReactNode;
	confirmationDialog: ReactNode;
};

const AppSettingsEditorLayout = ({
	open,
	onDialogOpenChange,
	onClose,
	modalContentProps,
	title,
	size = "M",
	sidebarTabs,
	mainContent,
	confirmationDialog,
}: AppSettingsEditorLayoutProps) => {
	return (
		<Dialog onOpenChange={onDialogOpenChange} open={open}>
			<DialogContent
				data-modal-root
				{...modalContentProps}
				className="h-[calc(100vh-2rem)] overflow-hidden p-0"
				showCloseButton={false}
				size={size}
			>
				<div className="absolute right-[18px] top-[18px] z-50 flex">
					<DialogClose className="-m-2 p-2 text-muted">
						<Icon className="h-4 w-4" icon="x" size="lg" />
					</DialogClose>
				</div>
				<ModalErrorHandler onClose={onClose} onError={() => {}}>
					<SidebarContainer>
						<Sidebar className="border-r border-secondary-border" collapsible="none">
							<SidebarHeader className="px-4 pb-2 pt-4">
								<div className="flex flex-col gap-1">
									<p className="text-sm font-semibold leading-none text-primary-fg">{title}</p>
								</div>
							</SidebarHeader>
							<SidebarContent>
								<SidebarGroup className="pt-1">
									<SidebarGroupContent>{sidebarTabs}</SidebarGroupContent>
								</SidebarGroup>
							</SidebarContent>
						</Sidebar>
						<main className="flex flex-1 flex-col overflow-hidden min-h-0">{mainContent}</main>
					</SidebarContainer>
				</ModalErrorHandler>
			</DialogContent>
			{confirmationDialog}
		</Dialog>
	);
};

export default AppSettingsEditorLayout;
