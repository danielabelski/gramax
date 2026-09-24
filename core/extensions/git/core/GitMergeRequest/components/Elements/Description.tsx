import t from "@ext/localization/locale/translate";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";

const Description = ({ content }: { content: string }) => {
	if (!content?.trim()) return null;

	return (
		<div className="flex max-w-full leading-tight">
			<span className="mr-0.5 shrink-0">{t("description")}:</span>
			<TextOverflowTooltip className="min-w-0">{content}</TextOverflowTooltip>
		</div>
	);
};

export default Description;
