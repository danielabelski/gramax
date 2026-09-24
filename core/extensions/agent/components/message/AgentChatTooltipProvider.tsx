import { ArticleTooltip, useArticleTooltip } from "@core-ui/ContextServices/ArticleTooltip";
import type { ReactNode } from "react";

export const AgentChatTooltipProvider = ({ children }: { children: ReactNode }) => {
	const { setLink, removeLink } = useArticleTooltip({ withMarkData: true });

	return <ArticleTooltip.Provider value={{ setLink, removeLink }}>{children}</ArticleTooltip.Provider>;
};
