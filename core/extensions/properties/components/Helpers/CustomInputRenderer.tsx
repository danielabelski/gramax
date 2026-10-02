import Input from "@components/Atoms/Input";
import parseNumber from "@core-ui/utils/parseNumber";
import t from "@ext/localization/locale/translate";
import { PropertyTypes } from "@ext/properties/models";
import { Calendar } from "@ui-kit/Calendar";
import { type ComponentType, useEffect, useState } from "react";

type BaseValue = string | number | Date;
export type InputValue = BaseValue | Array<BaseValue>;

interface InputProps<T = InputValue> {
	value: T;
	onChange: (value: T) => void;
}

const CalendarInput = (props: InputProps<Date>) => {
	const [selectedValue, setSelectedValue] = useState<Date>(props.value);
	const onSelect = (value: Date) => {
		setSelectedValue(value);
		props.onChange(value);
	};

	useEffect(() => {
		const isLocalizedDate = props.value instanceof Date;
		const selectedDate = isLocalizedDate ? props.value : new Date(props.value ? props.value : new Date());
		setSelectedValue(selectedDate);
	}, [props.value]);

	return (
		<Calendar
			className="border-0 shadow-none bg-transparent"
			classNames={{
				dropdown_root:
					"has-focus:border-ring has-focus:ring-ring/50 has-focus:ring-[3px] shadow-xs relative rounded-md border border-input text-foreground",
			}}
			defaultMonth={selectedValue}
			mode="single"
			onSelect={onSelect}
			selected={selectedValue}
		/>
	);
};

// A native number input drops everything it cannot read, so a comma typed as the decimal
// separator never reached the property at all. The field keeps the raw text the user types and
// reports the value through `parseNumber`, which reads the comma and the dot alike.
const NumericInput = (props: InputProps<number>) => {
	const [rawValue, setRawValue] = useState(props.value?.toString() ?? "");

	// Only the value coming from outside belongs in the dependency list: rawValue is what the
	// user is typing, and reacting to it would overwrite the text mid-entry.
	// biome-ignore lint/correctness/useExhaustiveDependencies: rawValue is read, never tracked
	useEffect(() => {
		if (parseNumber(rawValue) !== props.value) setRawValue(props.value?.toString() ?? "");
	}, [props.value]);

	const onChange = (value: string) => {
		setRawValue(value);
		props.onChange(parseNumber(value));
	};

	return (
		<Input
			inputMode="decimal"
			onChange={(e) => onChange(e.target.value)}
			placeholder={t("enter-number")}
			value={rawValue}
		/>
	);
};

const BaseInput = (props: InputProps<string>) => {
	return <Input onChange={(e) => props.onChange(e.target.value)} placeholder={t("enter-text")} value={props.value} />;
};

export const getInputComponent = (type: PropertyTypes): ComponentType<InputProps> => {
	return {
		[PropertyTypes.date]: CalendarInput,
		[PropertyTypes.numeric]: NumericInput,
		[PropertyTypes.text]: BaseInput,
	}[type];
};

interface CustomInputRendererProps extends Omit<InputProps, "onChange"> {
	type: PropertyTypes;
	onChange: (value: InputValue) => void;
}

export const CustomInputRenderer = (props: CustomInputRendererProps) => {
	const { type, value, onChange } = props;
	const InputComponent = getInputComponent(type);

	if (!InputComponent) return null;
	return <InputComponent onChange={onChange} value={value} />;
};
