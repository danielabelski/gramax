import type { HomeFolder } from "../utils/homeLayoutTypes";

export type ActiveDrag =
	| { type: "card"; name: string }
	| { type: "folder"; folder: HomeFolder }
	| { type: "group"; key: string; title: string }
	| null;

export type DropIndicator = { targetType: "card" | "folder"; targetId: string } | null;
