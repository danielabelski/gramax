import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import BranchUpdaterService from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import { PublishEmitter } from "@ext/git/actions/Publish/logic/PublishEmitter";
import type { DiffTree } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import formatComment from "@ext/git/core/GitPublish/logic/formatComment";
import { useCallback, useEffect, useState } from "react";

export type UsePublishProps = {
	diffTree: DiffTree;
	selectedFiles: Set<string>;

	onPublished?: () => void;
};

export type UsePublish = {
	isPublishing: boolean;

	message: string;

	publish: () => Promise<boolean>;
	setMessage: (message: string) => void;
};

const usePublish = ({ diffTree, selectedFiles, onPublished }: UsePublishProps): UsePublish => {
	const apiUrlCreator = ApiUrlCreatorService.value;

	const [isPublishing, setIsPublishing] = useState(false);

	const [message, setMessage] = useState<string>(formatComment(diffTree, selectedFiles));

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	const publish = useCallback(async () => {
		const commitMessage = message?.length > 0 && message;
		const files = Array.from(selectedFiles);

		setIsPublishing(true);
		const ok = await PublishEmitter.publish(apiUrlCreator, commitMessage, files);

		if (ok) onPublished?.();
		setIsPublishing(false);

		void BranchUpdaterService.updateBranch(apiUrlCreator, OnBranchUpdateCaller.Publish);
		return ok;
	}, [apiUrlCreator, message, selectedFiles, onPublished]);

	useEffect(() => {
		setMessage(formatComment(diffTree, selectedFiles));
	}, [diffTree, selectedFiles]);

	return {
		message,
		isPublishing,
		publish,

		setMessage,
	};
};

export default usePublish;
