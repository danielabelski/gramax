/** A search request that came back with an HTTP error, as opposed to one that came back empty. */
export class SearchRequestError extends Error {
	readonly status: number;

	constructor(status: number) {
		super(`search request failed with status ${status}`);
		this.name = "SearchRequestError";
		this.status = status;
	}
}
