import { cn } from "@core-ui/utils/cn";
import { type ChangeEventHandler, useEffect, useRef } from "react";

let idCounter = 0;

interface InputFileProps {
	children: JSX.Element;
	className?: string;
	onChange?: ChangeEventHandler<HTMLInputElement>;
	onAbort?: () => void;
	multiple?: boolean;
}

const InputFile = ({ children, onChange, onAbort, className, multiple }: InputFileProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const uniqueId = `file-input-${idCounter++}`;

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;

		input.addEventListener("cancel", onAbort);
		return () => input.removeEventListener("cancel", onAbort);
	}, [onAbort]);

	return (
		<label className={cn("relative inline-block", className)} htmlFor={uniqueId}>
			<input
				className="sr-only"
				id={uniqueId}
				multiple={multiple}
				onChange={onChange}
				ref={inputRef}
				type="file"
			/>
			{children}
		</label>
	);
};

export default InputFile;
