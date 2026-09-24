// biome-ignore lint/style/noRestrictedImports: expected
import styled from "@emotion/styled";
import { PopoverContent } from "@ui-kit/Popover";

// The slide stays here, but the fade is pushed onto the child: an ancestor with opacity < 1 becomes
// a backdrop root, so fading this element would leave the glass surface inside with nothing to blur.
// An element's own opacity does not affect its own backdrop-filter, so the child can fade freely.
export const AnimatedPopoverContent = styled(PopoverContent)`
	animation-name: slideDown !important;

	& > * {
		animation-duration: 150ms;
		animation-timing-function: ease;
		animation-fill-mode: both;
	}

	&[data-state="open"] > * {
		animation-name: fadeIn;
	}

	&[data-state="closed"] > * {
		animation-name: fadeOut;
	}

	@keyframes slideDown {
		from {
			transform: translateY(-10px);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
`;
