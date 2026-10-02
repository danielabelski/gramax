import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import type { ResourceServiceType } from "@core-ui/ContextServices/ResourceService/ResourceService";
import t from "@ext/localization/locale/translate";
import { toast } from "@ui-kit/Toast";
import type { EditorView } from "prosemirror-view";
import Path from "../../../../../../logic/FileProvider/Path/Path";

const createFile = async (files: File[], view: EditorView, apiUrlCreator: ApiUrlCreator, rs: ResourceServiceType) => {
	files = files.filter((f) => f);
	if (!files.length) return;

	const { schema } = view.state;
	const marked = [];
	const failed: string[] = [];

	for (const file of files) {
		const newName = await rs.setResource(file.name, Buffer.from(await file.arrayBuffer()));
		if (!newName) {
			failed.push(file.name);
			continue;
		}
		const newFilePath = new Path(newName);
		const value = newFilePath.extension ? newFilePath.nameWithExtension : newFilePath.name;
		const mark = schema.marks.file.create({
			href: apiUrlCreator.getArticleResource(newName).toString(),
			value,
			resourcePath: newName,
		});
		marked.push(schema.text(value, [mark]));
	}

	if (failed.length)
		toast(t("file-upload-failed"), { status: "error", icon: "triangle-alert", description: failed.join(", ") });

	if (!marked.length) return;

	const { from, to } = view.state.selection;
	const tr = view.state.tr;
	let rest = marked;

	if (from !== to) {
		tr.addMark(from, to, marked[0].marks[0]);
		rest = marked.slice(1);
	}

	const separated = rest.flatMap((node, i) => (i === 0 && from === to ? [node] : [schema.text(" "), node]));
	if (separated.length) tr.insert(to, separated);

	view.dispatch(tr);
};

export default createFile;
