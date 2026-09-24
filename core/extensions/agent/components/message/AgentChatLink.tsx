import Anchor, { type AnchorProps } from "@components/controls/Anchor";
import Path from "@core/FileProvider/Path/Path";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { getNoParentResource } from "@core-ui/ContextServices/ResourceService/utils/utils";
import { downloadFile } from "@core-ui/downloadResource";
import { LinkAdapter } from "@ext/agent/mcp/parser/adapters/linkAdapter";
import t from "@ext/localization/locale/translate";
import { openFilePreview } from "@ext/markdown/elements/file/edit/logic/openFilePreview";
import { toast } from "@ui-kit/Toast";
import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";

const AgentChatFileLink = ({ href, children }: { href: string; children: ReactNode }) => {
	const fetchingRef = useRef(false);
	const apiUrlCreator = ApiUrlCreatorService.value;

	const onClickHandler = async (event: MouseEvent<HTMLButtonElement>) => {
		if (fetchingRef.current) return;
		fetchingRef.current = true;

		const onError = () => {
			toast(t("file-not-found"), {
				status: "error",
				icon: "triangle-alert",
				description: t("file-download-error-message"),
				size: "lg",
			});
		};

		try {
			event.preventDefault();
			event.stopPropagation();

			const workspacePath = LinkAdapter.fromAgentFileHref(href);
			if (!workspacePath) return onError();

			const catalogName = new Path(workspacePath).rootDirectory.removeExtraSymbols.value;
			const catalogRelativePath = workspacePath.slice(catalogName.length + 1);
			const result = await getNoParentResource(
				new Path(catalogRelativePath),
				apiUrlCreator.fromNewArticlePath("", catalogName),
			);
			if (!result.buffer?.byteLength) return onError();

			const path = new Path(workspacePath);
			openFilePreview(result.buffer, path, {
				onError,
				downloadResource: () =>
					downloadFile(
						result.buffer,
						MimeTypes[path.extension] ?? path.extension,
						decodeURIComponent(path.nameWithExtension),
					),
			});
		} finally {
			fetchingRef.current = false;
		}
	};

	return (
		<button className="link" onClick={onClickHandler} type="button">
			{children}
		</button>
	);
};

export const AgentChatLink = ({ children, href, ...rest }: AnchorProps) => {
	if (href && LinkAdapter.fromAgentFileHref(href)) {
		return <AgentChatFileLink href={href}>{children}</AgentChatFileLink>;
	}

	return (
		<Anchor href={href} {...rest}>
			{children}
		</Anchor>
	);
};
