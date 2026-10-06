import { delayOf, type TooltipDelayTier, tooltipDelay } from "@core-ui/timings";
import {
	Tooltip as UiKitTooltip,
	TooltipProvider as UiKitTooltipProvider,
	TooltipTrigger as UiKitTooltipTrigger,
} from "ics-ui-kit/components/tooltip";
import {
	type ComponentPropsWithoutRef,
	createContext,
	forwardRef,
	type MouseEvent,
	type PointerEvent,
	useContext,
	useRef,
	useState,
} from "react";

const TooltipProviderContext = createContext<true | undefined>(undefined);

/** Set by a `Tooltip` with `showOnTouch`: opens it on a tap, which Radix ignores. */
const TouchTooltipContext = createContext<(() => void) | undefined>(undefined);

export const useIsTouchTooltip = () => useContext(TouchTooltipContext) !== undefined;

export const TooltipProvider = ({
	delayDuration = tooltipDelay.standard,
	skipDelayDuration = tooltipDelay.skip,
	...props
}: ComponentPropsWithoutRef<typeof UiKitTooltipProvider>) => {
	return (
		<TooltipProviderContext.Provider value={true}>
			<UiKitTooltipProvider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
		</TooltipProviderContext.Provider>
	);
};

/**
 * A raw `delayDuration` is deliberately not accepted: hover delays are a product-wide decision,
 * so a call site picks a named tier from `timings.ts` and gets nothing else. Omitting `delay`
 * means the standard one, taken from the provider.
 *
 * `showOnTouch` keeps the tooltip on touch screens: a tap on the trigger opens it, a tap outside
 * closes it. Use it only where the tooltip is the sole way to read its text.
 */
type TooltipProps = Omit<ComponentPropsWithoutRef<typeof UiKitTooltip>, "delayDuration"> & {
	delay?: TooltipDelayTier;
	showOnTouch?: boolean;
};

export const Tooltip = ({ delay, showOnTouch, ...props }: TooltipProps) => {
	const isInsideProvider = useContext(TooltipProviderContext);
	if (!isInsideProvider) {
		console.error("[Tooltip] Tooltip rendered outside of TooltipProvider context.");
	}
	// After the spread, not before: a `delayDuration` smuggled in through a spread or an `as any`
	// must not win over the named tier.
	if (!showOnTouch) return <UiKitTooltip {...props} delayDuration={delay && delayOf(delay)} />;
	return <TouchTooltip {...props} delayDuration={delay && delayOf(delay)} />;
};

const TouchTooltip = ({ open, onOpenChange, ...props }: ComponentPropsWithoutRef<typeof UiKitTooltip>) => {
	const [isOpen, setIsOpen] = useState(props.defaultOpen ?? false);

	const changeOpen = (value: boolean) => {
		setIsOpen(value);
		onOpenChange?.(value);
	};

	return (
		<TouchTooltipContext.Provider value={() => changeOpen(true)}>
			<UiKitTooltip {...props} onOpenChange={changeOpen} open={open ?? isOpen} />
		</TouchTooltipContext.Provider>
	);
};

export const TooltipTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof UiKitTooltipTrigger>>(
	({ onPointerDown, onClick, ...props }, ref) => {
		const openByTouch = useContext(TouchTooltipContext);
		const pointerTypeRef = useRef<string>();

		if (!openByTouch)
			return <UiKitTooltipTrigger {...props} onClick={onClick} onPointerDown={onPointerDown} ref={ref} />;

		const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
			pointerTypeRef.current = event.pointerType;
			onPointerDown?.(event);
		};

		const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
			onClick?.(event);
			if (pointerTypeRef.current !== "touch") return;
			// Radix closes the tooltip on a click unless the event is prevented.
			event.preventDefault();
			openByTouch();
		};

		return <UiKitTooltipTrigger {...props} onClick={handleClick} onPointerDown={handlePointerDown} ref={ref} />;
	},
);

TooltipTrigger.displayName = "TooltipTrigger";
