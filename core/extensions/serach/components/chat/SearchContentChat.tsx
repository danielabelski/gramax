import Anchor, { type AnchorProps } from "@components/controls/Anchor";
import Url from "@core-ui/ApiServices/Types/Url";
import t from "@ext/localization/locale/translate";
import getComponents from "@ext/markdown/core/render/components/getComponents/getComponents";
import Renderer from "@ext/markdown/core/render/components/Renderer";
import type { RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import type { OnLinkOpen } from "@ext/serach/components/hooks/useSearchResults";
import { Icon } from "@ui-kit/Icon";
import { useMemo } from "react";

export interface SearchContentChatProps {
	nodes: RenderableTreeNodes | null;
	onLinkOpen: OnLinkOpen;
}

export const SearchContentChat = (props: SearchContentChatProps) => {
	const { nodes, onLinkOpen } = props;

	const components = useMemo(() => {
		const ChatLink = (linkProps: AnchorProps) => (
			<Anchor
				{...linkProps}
				onClick={() => onLinkOpen({ url: Url.from({ pathname: linkProps.href }), pathname: linkProps.href })}
			/>
		);

		return { ...getComponents(), ChatLink };
	}, [onLinkOpen]);

	const content = useMemo(() => (nodes ? Renderer(nodes, { components }) : null), [nodes, components]);

	return (
		<div className="flex flex-col gap-2 px-2">
			<div className="flex items-center gap-2 text-muted text-sm font-medium">
				<Icon color="#6D28D9" icon="sparkles" size="md" />
				{t("search.ai")}
			</div>
			{content ? (
				<div className="article bg-transparent">
					<div className="main-article">
						<div className="article-body whitespace-pre-wrap">{content}</div>
					</div>
				</div>
			) : (
				<span className="flex items-center gap-2 text-muted text-sm">
					<Icon icon="circle-alert" size="md" />
					{t("app.error.command-failed.title")}
				</span>
			)}
		</div>
	);
};
