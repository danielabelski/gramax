import { NEW_ARTICLE_REGEX } from "@app/config/const";
import { createEventEmitter, type Event } from "@core/Event/EventEmitter";
import type { AliasEntry } from "@core/FileStructue/Alias/AliasIndex";
import { recordMoveAlias } from "@core/FileStructue/Alias/aliasAutowrite";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import { roundedOrderAfter } from "@core/FileStructue/Item/ItemOrderUtils";
import type { ItemRef } from "@core/FileStructue/Item/ItemRef";
import type { ItemType } from "@core/FileStructue/Item/ItemType";
import type Hasher from "@core/Hash/Hasher";
import type { Hashable } from "@core/Hash/Hasher";
import type ResourceUpdater from "@core/Resource/ResourceUpdater";
import type { InboxProps } from "@ext/inbox/models/types";
import t from "@ext/localization/locale/translate";
import type { ToSpan } from "@ext/loggers/opentelemetry";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import type IPermission from "../../../extensions/security/logic/Permission/IPermission";
import Permission from "../../../extensions/security/logic/Permission/Permission";
import type { ClientArticleProps } from "../../SitePresenter/SitePresenter";
import type { Category } from "../Category/Category";

export type ItemEvents = Event<"item-order-updated", { item: Item }> &
	Event<"item-pre-save", { item: Item; mutable: { content: string; props: ItemProps } }> &
	Event<"item-saved", { item: Item }> &
	Event<"item-changed", { item: Item; status: FileStatus }> &
	Event<"item-update-content", { item: Item }> &
	Event<"item-get-content", { item: Item; mutableContent: { content: string } }>;

declare module "@core/FileStructue/Item/Item" {
	interface ItemProps {
		title?: string;
		description?: string;
		tags?: string[];
		order?: number;
		logicPath?: string;

		hidden?: boolean;
		private?: string[];
		external?: string;

		shouldBeCreated?: boolean;

		searchPhrases?: string[];
		notifications?: { state?: string; groups?: string[]; users?: string[] };

		aliases?: AliasEntry[];
	}
}

export type UpdateItemProps = (ItemProps & { fileName?: never }) | ClientArticleProps | InboxProps;

// Props that define the item's place in navigation: changing one requires a nav re-scan,
// it cannot be patched into already-built ItemLinks.
export const NAV_STRUCTURAL_PROPS = ["order", "hidden"] as const;

export const ORDERING_MAX_PRECISION = 6;

export abstract class Item<P extends ItemProps = ItemProps> implements Hashable, ToSpan {
	protected _events = createEventEmitter<ItemEvents>();
	private _neededPermission: IPermission = null;

	constructor(
		protected _ref: ItemRef,
		protected _parent: Category,
		protected _props: P,
		protected _logicPath: string,
	) {
		this._neededPermission = new Permission(this._props.private);
	}

	get events() {
		return this._events;
	}

	get logicPath(): string {
		return this._logicPath;
	}

	set logicPath(value: string) {
		this._logicPath = value;
	}

	get ref(): ItemRef {
		return this._ref;
	}

	get parent(): Category {
		return this._parent;
	}

	set parent(value: Category) {
		this._parent = value;
	}

	get props() {
		return this._props;
	}

	get neededPermission(): IPermission {
		return this._neededPermission;
	}

	get order(): number {
		return this._props.order;
	}

	getTitle(): string {
		if (this.props.external) return this.props.external;
		const isNewArticle = NEW_ARTICLE_REGEX.test(this.getFileName());
		return this.props.title?.length
			? this.props.title
			: isNewArticle
				? t("article.no-name")
				: this.getFileName() || t("article.no-name");
	}

	async setOrder(order: number, silent = false) {
		if (this._props.order === order) return;
		this._props.order = order;
		if (!silent) await this.events.emit("item-order-updated", { item: this });
		await this._save();
	}

	async setOrderAfter(parent: Category, item?: Item) {
		const orders = parent.items.map((i) => i.order);
		const hasInvalidOrders = orders.some(Number.isNaN);
		const hasDuplicates = new Set(orders).size !== orders.length;

		if (hasInvalidOrders || hasDuplicates) await parent.sortItems("force");

		const categoryItemOrders = parent.items.map((i) => i.order);
		this._props.order = roundedOrderAfter(categoryItemOrders, item?.order ?? 0);
		await this.events.emit("item-order-updated", { item: this });
		await this._save();
	}

	async setNeededPermission(permission: IPermission) {
		this._neededPermission = permission;
		this._props.private = this._neededPermission.getValues();
		await this._save();
	}

	async saveTree() {
		await this.save();
		let target = this.parent;
		while (target?.parent) {
			await target.save();
			target = target.parent;
		}
	}

	async hash(hash: Hasher) {
		hash.hash(this.props.title);
		hash.hash(this.props.description);
		hash.hash(this.props.order);
		hash.hash(this.props.private);
		return Promise.resolve(hash);
	}

	abstract get type(): ItemType;

	abstract save(): Promise<void>;

	async updateProps(
		props: UpdateItemProps,
		resourceUpdater: ResourceUpdater,
		catalog: Catalog,
		fileNameOnly = false,
	): Promise<Item<P>> {
		!fileNameOnly && this._updateProps(props);
		if (!fileNameOnly && catalog && "aliases" in props) await catalog.aliases.apply(this, props.aliases);

		const previousFilename = this.getFileName();
		const previousLogicPath = this.logicPath;
		const shouldUpdateFilename = props.fileName && previousFilename !== props.fileName;
		const shouldRecordAlias =
			shouldUpdateFilename && !fileNameOnly && !!catalog && !NEW_ARTICLE_REGEX.test(previousFilename);
		// resolved before the rename: afterwards the main-language twin is no longer reachable by this path
		const aliasOwner = shouldRecordAlias ? (catalog.aliases.ownerFor(previousLogicPath) ?? this) : null;
		if (shouldRecordAlias)
			catalog.aliases.assertNotManual(catalog.aliases.relativePath(previousLogicPath), aliasOwner);
		if (props.fileName) await this._updateFilename(props.fileName, resourceUpdater, catalog);
		if (shouldUpdateFilename) await this.events.emit("item-changed", { item: this, status: FileStatus.delete });
		// The item now lives at its new path, so nobody else may keep an auto alias pointing
		// there. Not gated on shouldRecordAlias: renaming a brand-new article records no alias
		// of its own, but it occupies the path all the same.
		if (shouldUpdateFilename && catalog && this.logicPath !== previousLogicPath)
			await catalog.aliases.stealAuto(catalog.relativeLogicPath(this.logicPath), this);
		if (shouldRecordAlias && this.logicPath !== previousLogicPath) {
			const from = catalog.aliases.relativePath(previousLogicPath);
			await catalog.aliases.stealAuto(from, aliasOwner);
			recordMoveAlias(aliasOwner.props, from, catalog.aliases.relativePath(this.logicPath));
			if (aliasOwner !== this) await aliasOwner.save();
		}
		await this._save(shouldUpdateFilename);
		return this;
	}

	protected abstract _updateFilename(filename: string, ru: ResourceUpdater, catalog: Catalog): Promise<this>;
	protected abstract _updateProps(props: UpdateItemProps): void;

	abstract getFileName(): string;

	protected abstract _save(renamed?: boolean): Promise<void>;

	toSpan() {
		return {
			type: this.type,
			name: this.getTitle(),
			path: this.ref.path.value,
			props: this.props,
		};
	}
}
