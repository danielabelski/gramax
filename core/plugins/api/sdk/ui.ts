import type { MenuItem as MenuItemSDK, ModalProps, Modal as ModalSdk } from "@gramax/sdk/ui";
import type { ReactNode } from "react";
import { getDeps, type ModalInstance } from "./core";

// biome-ignore lint/complexity/useArrowFunction: it's a class, not a function, but we want to use a Proxy to override the constructor
const ModalTarget = function () {} as unknown as typeof ModalSdk;

export const Modal: typeof ModalSdk = new Proxy(ModalTarget, {
	construct(_target, args) {
		const ModalClass = getDeps().Modal;
		return Reflect.construct(ModalClass, args);
	},
});

export abstract class MenuItem implements MenuItemSDK {
	protected _id: string;
	declare component: (children: ReactNode) => ReactNode;
	declare getLabel: () => ReturnType<MenuItemSDK["getLabel"]>;
	declare getIcon: () => ReturnType<MenuItemSDK["getIcon"]>;
	declare getOnClick: () => ReturnType<MenuItemSDK["getOnClick"]>;

	constructor(id: string) {
		this._id = id;
	}

	getProps() {
		return {
			id: this._id,
			label: this.getLabel?.(),
			icon: this.getIcon?.(),
			onClick: this.getOnClick?.(),
		};
	}

	get isMenuItem(): boolean {
		return true;
	}
}

export type { ModalInstance, ModalProps };
