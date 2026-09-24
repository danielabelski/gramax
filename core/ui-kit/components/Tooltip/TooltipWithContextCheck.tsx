import { delayOf, type TooltipDelayTier, tooltipDelay } from "@core-ui/timings";
import { Tooltip as UiKitTooltip, TooltipProvider as UiKitTooltipProvider } from "ics-ui-kit/components/tooltip";
import { type ComponentPropsWithoutRef, createContext, useContext } from "react";

const TooltipProviderContext = createContext<true | undefined>(undefined);

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
 */
type TooltipProps = Omit<ComponentPropsWithoutRef<typeof UiKitTooltip>, "delayDuration"> & {
	delay?: TooltipDelayTier;
};

export const Tooltip = ({ delay, ...props }: TooltipProps) => {
	const isInsideProvider = useContext(TooltipProviderContext);
	if (!isInsideProvider) {
		console.error("[Tooltip] Tooltip rendered outside of TooltipProvider context.");
	}
	// After the spread, not before: a `delayDuration` smuggled in through a spread or an `as any`
	// must not win over the named tier.
	return <UiKitTooltip {...props} delayDuration={delay && delayOf(delay)} />;
};
