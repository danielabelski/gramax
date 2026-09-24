export interface SearchResultMatchProps {
	text: string;
}

export const SearchResultMatch = (props: SearchResultMatchProps) => {
	const { text } = props;

	return <span className="bg-[var(--search-fragment-highlight-bg)]">{text}</span>;
};
