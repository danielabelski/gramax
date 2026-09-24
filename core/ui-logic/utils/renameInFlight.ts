/** Where a rename moved the article: the tree and any pending action still name the path it left. */
export type RenameMove = { from: string; to: string };

let inFlight: Promise<RenameMove | undefined> | null = null;

const directoryOf = (path: string): string => path.slice(0, path.lastIndexOf("/") + 1);

/**
 * Where a path taken before the rename is now. Renaming a section moves its folder, so its
 * descendants move with it; renaming an article leaves every other path where it was.
 */
export const followRenamedPath = (path: string, move: RenameMove): string => {
	if (path === move.from) return move.to;
	const from = directoryOf(move.from);
	const to = directoryOf(move.to);
	return from !== to && path.startsWith(from) ? to + path.slice(from.length) : path;
};

/**
 * The rename the client is waiting on. Until it answers, the open article has no address the server
 * would accept: the file has already moved on disk and the new path arrives with the response.
 */
export const trackRenameInFlight = (rename: Promise<RenameMove | undefined>) => {
	inFlight = rename;
	void rename.then(() => {
		if (inFlight === rename) inFlight = null;
	});
};

/** Waits out a rename in flight and says where it went, so an id taken before it can follow. */
export const whenRenameSettled = async (): Promise<RenameMove | undefined> => (inFlight ? await inFlight : undefined);
