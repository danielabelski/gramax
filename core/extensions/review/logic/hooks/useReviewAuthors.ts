import useGitCommitAuthors from "@ext/git/actions/Branch/components/useGitCommitAuthors";
import { useCallback } from "react";

type Author = {
	name: string;
	email: string;
};

export const useReviewAuthors = (): { authors: Author[]; isLoading: boolean } => {
	const { authors: gitCommitAuthors, isLoading } = useGitCommitAuthors(true);

	const commentFilter = useCallback(
		(mail: string) => {
			return gitCommitAuthors.some((author) => author.email === mail);
		},
		[gitCommitAuthors],
	);

	return {
		authors: gitCommitAuthors.filter((author) => commentFilter(author.email)),
		isLoading,
	};
};
