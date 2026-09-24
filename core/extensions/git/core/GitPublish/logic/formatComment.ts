import type { DiffTree } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";

interface FormatCommentData {
	path: string;
	oldPath: string;
	resources: {
		path: string;
		oldPath: string;
	}[];
}

const formatPath = ({ path, oldPath }: { path?: string; oldPath?: string }) => {
	if (path && oldPath && path !== oldPath) return `${oldPath} -> ${path}`;
	return path ?? oldPath;
};

const formatComment = (data: DiffTree, selectedFilePaths: Set<string>) => {
	if (!data) return "";
	const newSelectedFilePaths = new Set(selectedFilePaths);
	const formatCommentData: FormatCommentData[] = [];
	const flatTree = data.data;

	flatTree.forEach((item, currentIndex) => {
		if (item.type === "node") return;
		if (!newSelectedFilePaths.has(item.filepath.new)) return;

		const resources: { path: string; oldPath: string }[] = [];

		for (let i = currentIndex + 1; i < flatTree.length; i++) {
			const next = flatTree[i];
			if (next.indent <= item.indent) break;
			if (next.type === "resource") {
				resources.push({
					path: next.filepath.new,
					oldPath: next.filepath.old,
				});
			}
		}

		formatCommentData.push({
			path: item.filepath.new,
			oldPath: item.filepath.old,
			resources,
		});

		newSelectedFilePaths.delete(item.filepath.new);
		if (item.filepath.old) newSelectedFilePaths.delete(item.filepath.old);

		resources.forEach((resource) => {
			newSelectedFilePaths.delete(resource.path);
			if (resource.oldPath) newSelectedFilePaths.delete(resource.oldPath);
		});
	});

	const paths: { path: string; prefix: string }[] = [];
	formatCommentData.forEach((data) => {
		paths.push({ path: formatPath({ path: data.path, oldPath: data.oldPath }), prefix: " - " });
		data.resources.forEach((resource) => {
			paths.push({ path: formatPath({ path: resource.path, oldPath: resource.oldPath }), prefix: "   - " });
		});
	});

	if (paths.length === 1) return `Update file: ${paths[0].path}`;
	return `Update ${paths.length} files\n\n${paths.map((data) => `${data.prefix}${data.path}`).join("\n")}`;
};

export default formatComment;
