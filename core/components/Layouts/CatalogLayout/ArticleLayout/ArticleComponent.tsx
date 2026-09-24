import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import ArticleLayout from "./ArticleLayout";

export interface ArticleComponentProps {
	article: JSX.Element;
}

const ArticleComponent = (props: ArticleComponentProps) => {
	const { article } = props;
	const useArticleDefaultStyles = ArticleViewService.useArticleDefaultStyles;
	const additionalStyles = ArticleViewService.additionalStyles;

	return (
		<ArticleLayout
			additionalStyles={additionalStyles}
			article={article}
			useArticleDefaultStyles={useArticleDefaultStyles}
		/>
	);
};

export default ArticleComponent;
