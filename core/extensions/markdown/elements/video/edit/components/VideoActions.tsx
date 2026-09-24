import ActionButton from "@components/controls/HoverController/ActionButton";
import ActionInput from "@components/controls/HoverController/ActionInput";
import toggleSignature from "@core-ui/toggleSignature";
import t from "@ext/localization/locale/translate";
import type { Node } from "@tiptap/pm/model";
import type { ChangeEvent, Dispatch, ReactElement, RefObject, SetStateAction } from "react";

interface VideoActionsProps {
	signatureRef: RefObject<HTMLInputElement>;
	updateAttributes: (attrs: Record<string, string>) => void;
	node: Node;
	setHasSignature: Dispatch<SetStateAction<boolean>>;
}

const VideoActions = (props: VideoActionsProps): ReactElement => {
	const { node, setHasSignature, signatureRef, updateAttributes } = props;

	const addSignature = () => {
		setHasSignature((prev) => toggleSignature(prev, signatureRef.current, updateAttributes));
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value;
		updateAttributes({ path: value });
	};

	return (
		<>
			<ActionInput
				defaultValue={node.attrs.path}
				icon="link"
				onChange={onChange}
				tooltipText={t("editor.video.link")}
			/>
			{node.attrs.path && (
				<ActionButton
					href={node.attrs.path}
					icon="external-link"
					rel="noreferrer"
					target="_blank"
					tooltipText={t("goto-original")}
				/>
			)}
			<ActionButton icon="captions" onClick={addSignature} tooltipText={t("signature")} />
		</>
	);
};

export default VideoActions;
