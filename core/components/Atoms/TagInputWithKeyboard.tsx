import { useItemsKeyboardNavigation } from "@ui-kit/hooks/useItemsKeyboardNavigation";
import { Input } from "@ui-kit/Input";
import { SearchSelectTag } from "@ui-kit/SearchSelect";

import { useCallback, useMemo, useRef, useState } from "react";

interface TagInputWithKeyboardProps {
	value: string[];
	onChange: (tags: string[]) => void;
	/**
	 * Entries the list always carries and nobody can take out — shown first, with no remove button and
	 * deaf to the delete keys. Typing one of them adds nothing, since it is already there.
	 */
	lockedValues?: string[];
	placeholder?: string;
	readonly?: boolean;
	description?: string;
	/**
	 * Handed down by `FormField`'s `FormControl` slot; they have to reach the real `<input>`, or the
	 * field's `<label htmlFor>` names nothing and the tag list has no accessible name.
	 */
	id?: string;
	"aria-describedby"?: string;
}

const NO_LOCKED_VALUES: string[] = [];

const TagInputWithKeyboard = ({
	value,
	onChange,
	lockedValues = NO_LOCKED_VALUES,
	placeholder,
	readonly,
	description,
	id,
	"aria-describedby": ariaDescribedBy,
}: TagInputWithKeyboardProps) => {
	const [inputValue, setInputValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// One list for the eye and the keyboard alike; the locked entries lead, so an index below their
	// count names one of them and everything past it maps straight onto `value`.
	const tags = useMemo(
		() => [...lockedValues, ...value.filter((tag) => !lockedValues.includes(tag))],
		[lockedValues, value],
	);

	const removeTag = useCallback(
		(tag: string, index: number) => {
			if (readonly || index < lockedValues.length) return;
			onChange(value.filter((current) => current !== tag));
			inputRef.current?.focus();
		},
		[readonly, value, lockedValues, onChange],
	);

	const {
		handleKeyDown: handleTagsKeyDown,
		isFocused,
		focusItemAtIndex,
	} = useItemsKeyboardNavigation({
		items: tags,
		onDelete: removeTag,
		cycleNavigation: true,
	});

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && inputValue.trim()) {
			e.preventDefault();
			const trimmed = inputValue.trim();
			if (!tags.includes(trimmed)) {
				onChange([...value, trimmed]);
				setInputValue("");
			}
			return;
		}
		if (!inputValue.trim()) {
			handleTagsKeyDown(e);
		}
	};

	return (
		<div className="group/search-select-trigger flex flex-col gap-2 w-full">
			<Input
				aria-describedby={ariaDescribedBy}
				id={id}
				onChange={(e) => setInputValue(e.target.value)}
				onKeyDown={handleInputKeyDown}
				placeholder={placeholder}
				readOnly={readonly}
				ref={inputRef}
				value={inputValue}
			/>
			{tags.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{tags.map((tag, index) => (
						<SearchSelectTag
							isFocused={isFocused(index)}
							key={tag}
							onClose={() => removeTag(tag, index)}
							onLabelClick={() => focusItemAtIndex(index)}
							readonly={readonly || index < lockedValues.length}
						>
							{tag}
						</SearchSelectTag>
					))}
				</div>
			)}
			{description && <div className="text-muted font-normal text-xs">{description}</div>}
		</div>
	);
};

export default TagInputWithKeyboard;
