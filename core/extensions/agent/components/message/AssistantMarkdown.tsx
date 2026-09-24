import { MinimizedArticleStyled } from "@components/Article/MiniArticle";
import { classNames } from "@components/libs/classNames";
import { cn } from "@core-ui/utils/cn";
import { AgentChatLink } from "@ext/agent/components/message/AgentChatLink";
import { AgentChatTooltipProvider } from "@ext/agent/components/message/AgentChatTooltipProvider";
import { highlightSecretsInChatMessage } from "@ext/agent/components/utils/secret/secretChatHighlight";
import { useAgentSecretNames } from "@ext/agent/components/utils/secret/useAgentSecretNames";
import SimpleMarkdownParser from "@ext/markdown/core/Parser/SimpleMarkdownParser";
import getComponents from "@ext/markdown/core/render/components/getComponents/getComponents";
import Renderer from "@ext/markdown/core/render/components/Renderer";
import type { RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import { useEffect, useMemo, useState } from "react";

const simpleParser = new SimpleMarkdownParser();

type Props = {
	text: string;
	className?: string;
};

export const AssistantMarkdown = ({ text, className }: Props) => {
	const [renderTree, setRenderTree] = useState<RenderableTreeNodes | null>(null);
	const components = useMemo(() => ({ ...getComponents(), a: AgentChatLink }), []);
	const knownSecretNames = useAgentSecretNames();

	useEffect(() => {
		let disposed = false;
		if (!text.trim()) {
			setRenderTree(null);
			return;
		}

		void simpleParser
			.parse(text)
			.then((tree) => {
				if (!disposed) {
					setRenderTree(highlightSecretsInChatMessage(tree, knownSecretNames ?? []));
				}
			})
			.catch(() => {
				if (!disposed) {
					setRenderTree(null);
				}
			});
		return () => {
			disposed = true;
		};
	}, [text, knownSecretNames]);

	if (!renderTree) {
		return (
			<div
				className={cn(
					"whitespace-pre-wrap wrap-break-word text-sm text-primary-fg group-data-[gray]:!text-muted-foreground",
					className,
				)}
			>
				{text}
			</div>
		);
	}

	return (
		<div className="min-w-0 bg-transparent text-sm">
			<div
				className={cn("article group-data-[gray]:!text-muted-foreground", className)}
				style={{ background: "transparent" }}
			>
				<AgentChatTooltipProvider>
					<MinimizedArticleStyled>
						<div className={classNames("article-body", {}, ["popup-article"])}>
							{Renderer(renderTree, { components })}
						</div>
					</MinimizedArticleStyled>
				</AgentChatTooltipProvider>
			</div>
		</div>
	);
};
