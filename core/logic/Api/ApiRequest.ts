interface ApiRequest {
	headers: { [name: string]: string };
	query: { [name: string]: string | string[] };
	// biome-ignore lint/suspicious/noExplicitAny: idc
	body: any;
	method?: string;
	clientAbortSignal?: AbortSignal;
}

export default ApiRequest;
