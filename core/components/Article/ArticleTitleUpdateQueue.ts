import { useRef } from "react";

type UpdateArticleTitle = (title: string, fileName?: string) => Promise<void>;

export type ArticleTitleUpdateQueue = ((title: string, fileName?: string) => Promise<void>) & {
	drop: () => void;
};

export const createArticleTitleUpdateQueue = (update: UpdateArticleTitle): ArticleTitleUpdateQueue => {
	let pending = Promise.resolve();
	let lastUpdate: { title: string; fileName?: string } | undefined;
	let generation = 0;

	const enqueue = (title: string, fileName?: string) => {
		const ownGeneration = generation;
		const run = async () => {
			if (ownGeneration !== generation) return;
			if (lastUpdate?.title === title && lastUpdate.fileName === fileName) return;
			lastUpdate = { title, fileName };
			await update(title, fileName);
		};

		pending = pending.then(run, run);
		return pending;
	};

	enqueue.drop = () => {
		generation++;
		lastUpdate = undefined;
	};

	return enqueue;
};

export const useArticleTitleUpdateQueue = (update: UpdateArticleTitle) => {
	const updateRef = useRef(update);
	updateRef.current = update;

	const queueRef = useRef<ArticleTitleUpdateQueue | null>(null);
	queueRef.current ??= createArticleTitleUpdateQueue((title, fileName) => updateRef.current(title, fileName));

	return queueRef.current;
};
