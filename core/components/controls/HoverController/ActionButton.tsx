import Icon from "@components/Atoms/Icon";
import Tooltip from "@components/Atoms/Tooltip";
import { classNames } from "@components/libs/classNames";
// biome-ignore lint/style/noRestrictedImports: pre-existing @emotion/styled import; the Tailwind migration is not this change's scope
import styled from "@emotion/styled";
import {
	type AnchorHTMLAttributes,
	type ButtonHTMLAttributes,
	forwardRef,
	type MouseEvent,
	memo,
	type Ref,
	useCallback,
} from "react";

type ActionButtonElement = HTMLAnchorElement | HTMLButtonElement;

type ActionButtonNativeProps = Omit<
	AnchorHTMLAttributes<HTMLAnchorElement> & ButtonHTMLAttributes<HTMLButtonElement>,
	"className" | "disabled" | "href" | "onClick" | "onMouseLeave" | "type"
>;

interface ActionButtonProps extends ActionButtonNativeProps {
	icon: string;
	selected?: boolean;
	tooltipText?: string;
	className?: string;
	disabled?: boolean;
	dataTestId?: string;
	href?: string;
	onClick?: (e: MouseEvent<ActionButtonElement>) => void;
	onMouseLeave?: () => void;
}

const ActionButton = forwardRef<ActionButtonElement, ActionButtonProps>((props, ref) => {
	const { icon, tooltipText, onClick, className, disabled, dataTestId, onMouseLeave, selected, href, ...restProps } =
		props;

	const preClick = useCallback(
		(e: MouseEvent<ActionButtonElement>) => {
			if (disabled) return;
			onClick?.(e);
		},
		[onClick, disabled],
	);

	const sharedProps = {
		"aria-label": tooltipText,
		className: classNames(className, { selected, disabled }),
		"data-testid": dataTestId,
		onClick: preClick,
		onMouseLeave,
		...restProps,
	};

	return (
		<Tooltip content={tooltipText}>
			{href ? (
				<a {...sharedProps} href={href} ref={ref as Ref<HTMLAnchorElement>}>
					<Icon code={icon} />
				</a>
			) : (
				<button {...sharedProps} ref={ref as Ref<HTMLButtonElement>} type="button">
					<Icon code={icon} />
				</button>
			)}
		</Tooltip>
	);
});

export default memo(styled(ActionButton)`
	appearance: none;
	background: none;
	border: none;
	margin: 0;
	font: inherit;
	text-align: inherit;
	text-decoration: none;
	display: flex;
	align-items: center;
	cursor: pointer;
	justify-content: center;
	color: var(--color-primary-general);
	padding: 7px 8px;

	&:hover {
		color: var(--color-primary);
	}

	&.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`);
