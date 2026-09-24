import InputFile from "@components/Atoms/InputFile";
import ArticlePropsService from "@core-ui/ContextServices/ArticleProps";
import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import t from "@ext/localization/locale/translate";
import type { Editor } from "@tiptap/core";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";
import { type ChangeEvent, useCallback } from "react";
import createImages from "../logic/createImages";

interface ImageMenuButtonProps {
	editor: Editor;
	fileName?: string;
	onSave?: () => void;
	onStart?: () => void;
}

const ImageMenuButton = ({ editor, fileName, onSave, onStart }: ImageMenuButtonProps) => {
	const articleProps = ArticlePropsService.value;
	const resourceService = ResourceService.value;

	const { disabled, isActive } = ButtonStateService.useCurrentAction({ action: "image" });

	const onAbort = useCallback(() => {
		onSave?.();
	}, [onSave]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	const onChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			await createImages(
				[...event.currentTarget.files],
				editor.view,
				fileName || articleProps?.fileName,
				resourceService,
			);
			event.target.value = "";
			onSave?.();
		},
		[editor.view, fileName, articleProps?.fileName, resourceService, onSave],
	);

	if (disabled) {
		return (
			<DropdownMenuRadioGroup value={isActive ? "image" : undefined}>
				<DropdownMenuRadioItem disabled={disabled} value="image">
					<div className="flex flex-row items-center gap-2 w-full" data-qa="qa-edit-menu-image">
						<Icon icon="image" />
						{t("image")}
					</div>
				</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
		);
	}

	return (
		<DropdownMenuRadioGroup value={isActive ? "image" : undefined}>
			<DropdownMenuRadioItem
				className="relative flex flex-row items-center gap-2 whitespace-nowrap"
				disabled={disabled}
				onSelect={(e) => {
					e.preventDefault();
					onStart?.();
				}}
				value="image"
			>
				<InputFile
					className="flex flex-row items-center w-full cursor-pointer"
					onAbort={onAbort}
					onChange={onChange}
				>
					<div className="flex flex-row items-center gap-2 w-full" data-qa="qa-edit-menu-image">
						<Icon icon="image" />
						{t("image")}
					</div>
				</InputFile>
			</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	);
};

export default ImageMenuButton;
