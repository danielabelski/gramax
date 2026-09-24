import type Path from "@core/FileProvider/Path/Path";
import type PathnameData from "@core/RouterPath/model/PathnameData";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import { expandShortEditorPath, isShortEditorPath } from "./EnterpriseRouterPathEvents";

export const parsePathCandidates = (path: string[] | string | Path): PathnameData[] => {
	const segments = RouterPathProvider.parseItemLogicPath(
		Array.isArray(path) ? path : path.toString().split("/").filter(Boolean),
	).fullPath;
	const offset = segments[0] === "public" ? 1 : 0;
	if (isShortEditorPath(segments))
		return [
			RouterPathProvider.parseEditorPath(expandShortEditorPath(segments)),
			RouterPathProvider.parseEditorPath(segments),
		];
	if (segments[offset + 4] === "-") return [RouterPathProvider.parseEditorPath(segments)];
	return [RouterPathProvider.parsePath(path)];
};
