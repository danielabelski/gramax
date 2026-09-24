export type FsEventKind =
	| { type: "created" }
	| { type: "modified" }
	| { type: "removed" }
	| { type: "renamed"; from: string }
	/** The backend dropped events. Carries no path — everything under the watch root is suspect. */
	| { type: "rescan" };

export interface FsEventDto {
	relPath: string;
	kind: FsEventKind;
}

export const BROADCAST_CHANNEL_NAME = "gramax-fs-events";
