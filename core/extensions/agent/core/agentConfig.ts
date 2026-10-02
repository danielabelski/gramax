class AgentConfig {
	maxStoredSessions: number | null = null;
	maxSteps: number | null = null;
	compactionTriggerPercent = 90;
	compactionTailUserCharsBudget = 20_000;
	toolPreviewMaxChars = 8_000;
	readMaxChars = 60_000;
	searchHitsDefault = 15;
	searchHitsMax = 100;
	searchQueryMaxChars = 500;
	searchScanDeadlineMs = 30_000;
	searchCatalogsMaxMatchesPerHit = 2;
	searchFilesMaxMatchesDefault = 1;
	searchFilesMaxMatchesLimit = 3;
	searchMatchLineMaxChars = 320;
	searchTimeoutMs = 120_000;
	searchIndexProgressWaitMs = 300_000;
	repoExcludedPathPatterns = [/(^|\/)\.git(\/|$)/i];
	systemPrefix = "@system";
	skillPrefix = "@skills";
	attachmentPrefix = "@attachments";
	resourcePrefix = "@resources";
	maxAttachmentMb = 50;
	get maxAttachmentBytes() {
		return this.maxAttachmentMb * 1024 * 1024;
	}
	httpRequestTimeoutMs = 120_000;
	imageAttachmentExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
	convertibleAttachmentExtensions = ["pdf", "docx", "xlsx"];
	binaryAttachmentExtensions = [
		"mp3",
		"wav",
		"m4a",
		"flac",
		"ogg",
		"opus",
		"mp4",
		"mov",
		"avi",
		"mkv",
		"pptx",
		"ppt",
		"doc",
		"odt",
		"ods",
		"zip",
		"bin",
	];
	allowedAttachmentExtensions = [
		"txt",
		"md",
		"markdown",
		"json",
		"xml",
		"yaml",
		"yml",
		"csv",
		"html",
		"htm",
		"log",
		"ts",
		"tsx",
		"js",
		"jsx",
		"css",
		"sql",
		"ini",
		"toml",
		...this.imageAttachmentExtensions,
		...this.convertibleAttachmentExtensions,
		...this.binaryAttachmentExtensions,
	];
}

export const agentConfig = new AgentConfig();
