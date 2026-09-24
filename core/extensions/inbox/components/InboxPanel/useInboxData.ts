import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import InboxService from "@ext/inbox/components/InboxService";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const useInboxData = (currentUser: string | undefined, isOpen: boolean) => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { items } = InboxService.value;
	const [authors, setAuthors] = useState<string[]>([]);
	const [selectedAuthor, setSelectedAuthor] = useState(currentUser ?? "");
	const selectedAuthorRef = useRef(selectedAuthor);
	const isStorageConnected = useIsStorageConnected();
	selectedAuthorRef.current = selectedAuthor;

	const loadNotes = useCallback(async (author: string) => {
		if (author) await InboxService.fetchInbox(author, apiUrlCreator);
	}, []);

	const loadAuthors = useCallback(async () => {
		const response = await FetchService.fetch<string[]>(apiUrlCreator.getInboxUsers());
		if (!response.ok) return;
		const values = await response.json();
		const nextAuthors = Array.from(new Set([currentUser, ...values].filter(Boolean))).sort();
		setAuthors((current) =>
			current.length === nextAuthors.length && current.every((author, index) => author === nextAuthors[index])
				? current
				: nextAuthors,
		);
	}, [currentUser]);

	useEffect(() => {
		if (currentUser && isStorageConnected) setSelectedAuthor(currentUser);
	}, [currentUser, isStorageConnected]);

	useEffect(() => {
		if (!currentUser || !isOpen) return;
		if (isStorageConnected) void loadAuthors();

		void loadNotes(selectedAuthorRef.current || currentUser);
	}, [currentUser, isOpen, loadAuthors, loadNotes, isStorageConnected]);

	const notes = useMemo(
		() => [...items].sort((left, right) => Date.parse(right.props.date) - Date.parse(left.props.date)),
		[items],
	);

	return { authors, loadNotes, notes, selectedAuthor, setSelectedAuthor, shouldShow: isStorageConnected };
};
