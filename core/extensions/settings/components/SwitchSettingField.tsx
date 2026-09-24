import SettingField from "@ext/settings/components/SettingField";
import { Description } from "@ui-kit/Description";
import { Switch } from "@ui-kit/Switch";
import type { ComponentProps } from "react";

type SwitchSettingFieldProps = Omit<ComponentProps<typeof SettingField>, "control" | "layout"> & {
	/** value the switch shows while the setting has none stored yet */
	fallbackValue?: boolean;
};

/** Boolean settings row — switch next to the title, description underneath, as in the admin panel. */
const SwitchSettingField = ({ description, fallbackValue = false, ...rest }: SwitchSettingFieldProps) => {
	return (
		<div className="flex flex-col gap-0.5">
			<SettingField
				{...rest}
				className="items-center"
				control={({ field }) => (
					<Switch
						checked={field.value ?? fallbackValue}
						onBlur={field.onBlur}
						onCheckedChange={field.onChange}
						ref={field.ref}
						size="sm"
					/>
				)}
				labelClassName="w-auto shrink-0 justify-center"
			/>
			{description && <Description size="xs">{description}</Description>}
		</div>
	);
};

export default SwitchSettingField;
