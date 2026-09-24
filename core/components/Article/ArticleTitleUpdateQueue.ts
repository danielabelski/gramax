import { useRef } from "react";

type UpdateArticleTitle = (title: string, fileName?: string) => Promise<void>;

export const createArticleTitleUpdateQueue = (update: UpdateArticleTitle) => {
	let pending = Promise.resolve();
	let lastUpdate: { title: string; fileName?: string } | undefined;

	return (title: string, fileName?: string) => {
		const run = async () => {
			if (lastUpdate?.title === title && lastUpdate.fileName === fileName) return;
			lastUpdate = { title, fileName };
			await update(title, fileName);
		};

		pending = pending.then(run, run);
		return pending;
	};
};

export const useArticleTitleUpdateQueue = (update: UpdateArticleTitle) => {
	const updateRef = useRef(update);
	updateRef.current = update;

	const queueRef = useRef<ReturnType<typeof createArticleTitleUpdateQueue> | null>(null);
	queueRef.current ??= createArticleTitleUpdateQueue((title, fileName) => updateRef.current(title, fileName));

	return queueRef.current;
};
