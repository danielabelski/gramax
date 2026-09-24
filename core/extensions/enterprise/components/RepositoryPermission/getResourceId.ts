export const getResourceId = (pathName: string, sourceName: string, catalogName: string) => {
	const prefix = `${sourceName}/`;
	const decodedPathName = decodeURIComponent(pathName);
	const withoutSource = decodedPathName.startsWith(prefix) ? decodedPathName.slice(prefix.length) : decodedPathName;
	const segments = withoutSource.split("/").filter(Boolean);
	const catalogIndex = segments.indexOf(catalogName);
	if (catalogIndex === -1) return withoutSource;
	return segments.slice(0, catalogIndex + 1).join("/");
};
