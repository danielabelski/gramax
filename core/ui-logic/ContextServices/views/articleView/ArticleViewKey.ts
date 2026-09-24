import { createContext, useContext } from "react";

/**
 * Identity of the open article view. A rename carries it, so a response landing late cannot be
 * taken for another article that has since reused the path — paths repeat, views do not.
 */
const ArticleViewKeyContext = createContext<string | null>(null);

export const ArticleViewKeyProvider = ArticleViewKeyContext.Provider;

export const useArticleViewKey = (): string | null => useContext(ArticleViewKeyContext);
