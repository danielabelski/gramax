interface ApiResponse {
	statusCode: number;
	headers: { [key: string]: string };
	headersSent?: boolean;
	ok: boolean;
	setHeader: (name: string, value: string) => void;
	getHeader?: (name: string) => string;
	redirect: (href: string) => void;
	arrayBuffer: () => Promise<Uint8Array>;
	// biome-ignore lint/suspicious/noExplicitAny: idc
	send: (body: any) => void;
	// biome-ignore lint/suspicious/noExplicitAny: idc
	end: (body?: any) => void;
}

export default ApiResponse;
