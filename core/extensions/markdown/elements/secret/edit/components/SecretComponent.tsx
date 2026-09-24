import { cn } from "@core-ui/utils/cn";
import { formatSecretName } from "@ext/markdown/elements/secret/edit/logic/secretFields";
import { SECRET_HIGHLIGHT_CLASS } from "@ext/markdown/elements/secret/edit/logic/secretMatch";
import { NodeSelection } from "@tiptap/pm/state";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";

const SecretComponent = ({ node, editor, selected }: NodeViewProps) => {
	const isSelected = selected && editor.state.selection instanceof NodeSelection;

	return (
		<NodeViewWrapper
			as="span"
			className={cn(
				SECRET_HIGHLIGHT_CLASS,
				"cursor-pointer select-none",
				"hover:border-[var(--color-comment-hover-bg)] hover:bg-[var(--color-comment-hover-bg)]",
				isSelected && "border-[var(--color-comment-active-bg)] bg-[var(--color-comment-active-bg)]",
			)}
			data-drag-handle
			data-focusable="true"
			draggable
		>
			{formatSecretName(node.attrs.name)}
		</NodeViewWrapper>
	);
};

export default SecretComponent;
