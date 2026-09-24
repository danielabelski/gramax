import ElementGroups from "@ext/markdown/core/element/ElementGroups";

const code_block = {
	group: `${ElementGroups.block} ${ElementGroups.listItemContent}`,
	marks: "",
	code: true,
	defining: true,
	content: "text*",
	attrs: { language: { default: null }, gitConflict: { default: false } },
};

export default code_block;
