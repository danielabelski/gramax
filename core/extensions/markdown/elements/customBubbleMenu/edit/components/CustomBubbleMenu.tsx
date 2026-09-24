import {
	type BubbleMenuPluginProps,
	CustomBubbleMenuPlugin,
} from "@ext/markdown/elements/customBubbleMenu/edit/logic/customBubbleMenuPlugin";
import { useCurrentEditor } from "@tiptap/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type TippyOptions = BubbleMenuPluginProps["tippyOptions"];

export type BubbleMenuProps = Omit<
	Optional<BubbleMenuPluginProps, "pluginKey">,
	"element" | "editor" | "tippyOptions"
> & {
	editor: BubbleMenuPluginProps["editor"] | null;
	className?: string;
	children: React.ReactNode;
	updateDelay?: number;
	tippyOptions?: TippyOptions | (() => TippyOptions);
};

export const CustomBubbleMenu = (props: BubbleMenuProps) => {
	const [element, setElement] = useState<HTMLDivElement | null>(null);
	const { editor: currentEditor } = useCurrentEditor();
	const { editor: providedEditor, pluginKey = "bubbleMenu", shouldShow = null, tippyOptions, updateDelay } = props;
	const tippyOptionsRef = useRef(tippyOptions);
	tippyOptionsRef.current = tippyOptions;

	useEffect(() => {
		if (!element) {
			return;
		}

		if (providedEditor?.isDestroyed || currentEditor?.isDestroyed) {
			return;
		}

		const tippyOptions =
			typeof tippyOptionsRef.current === "function" ? tippyOptionsRef.current() : (tippyOptionsRef.current ?? {});

		const menuEditor = providedEditor || currentEditor;

		if (!menuEditor) {
			console.warn(
				"BubbleMenu component is not rendered inside of an editor component or does not have editor prop.",
			);
			return;
		}

		const plugin = CustomBubbleMenuPlugin({
			updateDelay,
			editor: menuEditor,
			element,
			pluginKey,
			shouldShow,
			tippyOptions,
		});

		menuEditor.registerPlugin(plugin);
		return () => {
			menuEditor.unregisterPlugin(pluginKey);
		};
	}, [currentEditor, element, pluginKey, providedEditor, shouldShow, updateDelay]);

	return (
		<div className={props.className} ref={setElement} style={{ visibility: "hidden" }}>
			{props.children}
		</div>
	);
};
