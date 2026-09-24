function fenceToken() {
	return {
		block: "code_block",
		getAttrs: (tok) => ({
			language: tok.info?.replace("none", ""),
			gitConflict: tok.meta?.gitConflict === true,
		}),
		noCloseToken: true,
	};
}

export default fenceToken;
