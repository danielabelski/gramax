import type { CommandTree } from "@app/commands";
import type Application from "@app/types/Application";
import type DocportalApiRequest from "../logic/DocportalApiRequest";
import type DocportalApiResponse from "../logic/DocportalApiResponse";

export default class ServerContext {
	constructor(
		readonly path: URL,
		readonly req: DocportalApiRequest,
		readonly res: DocportalApiResponse,
		readonly app: Application,
		readonly commands: CommandTree,
	) {}

	json(statusCode: number, body: Record<string, unknown>): Response {
		this.res.statusCode = statusCode;
		this.res.setHeader("Content-Type", "application/json");
		this.res.send(JSON.stringify(body));
		return this.res.getBunResponse();
	}
}
