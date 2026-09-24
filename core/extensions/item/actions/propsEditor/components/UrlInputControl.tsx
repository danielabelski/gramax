import { InputGroup, InputGroupInput, InputGroupText } from "@ui-kit/Input";
import { type ComponentProps, forwardRef, type ReactNode } from "react";

/**
 * The url field: the catalog-relative prefix, then the editable segment.
 *
 * `FormControl` renders whatever `control` returns through a Radix `Slot`, which clones the field's
 * `id` / `aria-describedby` / `aria-invalid` onto that single element. `InputGroup` is a layout
 * wrapper, so it would swallow them and leave the field's `<label htmlFor>` pointing at a `div`,
 * with the input itself unnamed — hence the wrapper forwards everything to the input.
 */
export type UrlInputControlProps = ComponentProps<typeof InputGroupInput> & {
	prefix: ReactNode;
};

const UrlInputControl = forwardRef<HTMLInputElement, UrlInputControlProps>(({ prefix, ...inputProps }, ref) => (
	<InputGroup>
		<InputGroupText className="max-w-[65%] overflow-x-auto whitespace-nowrap [mask-image:linear-gradient(to_left,rgba(255,255,255,0),#fff_15%)]">
			{prefix}
		</InputGroupText>
		<InputGroupInput className="border-l rounded-l-none border-l-secondary-border" ref={ref} {...inputProps} />
	</InputGroup>
));
UrlInputControl.displayName = "UrlInputControl";

export default UrlInputControl;
