import type { HomeItemKind } from "../utils/homeLayoutTypes";

export const CARD_ID_PREFIX = "card:";
export const FOLDER_ID_PREFIX = "folder:";
export const GROUP_ID_PREFIX = "group:";

export const cardId = (name: string) => `${CARD_ID_PREFIX}${name}`;
export const folderId = (id: string) => `${FOLDER_ID_PREFIX}${id}`;

export const DROP_ZONE_ID_PREFIX = "zone:";
export const dropZoneId = (key: string) => `${DROP_ZONE_ID_PREFIX}${key}`;

export type ItemKind = "card" | "folder";

export const itemKind = (id: string): ItemKind | null =>
	id.startsWith(CARD_ID_PREFIX) ? "card" : id.startsWith(FOLDER_ID_PREFIX) ? "folder" : null;

export const rawIdOf = (id: string, kind: ItemKind) =>
	kind === "card" ? id.slice(CARD_ID_PREFIX.length) : id.slice(FOLDER_ID_PREFIX.length);

export const toHomeItemKind = (kind: ItemKind): HomeItemKind => (kind === "card" ? "catalog" : "folder");
