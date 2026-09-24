import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { Prose } from "@ui-kit/Prose";

export const SearchContentHelp = () => {
	return (
		<Prose
			className={cn(
				"font-normal text-muted text-sm",
				"[&_code]:font-normal [&_code]:text-xs [&_code]:inline-block [&_code]:py-px [&_code]:px-1",
			)}
		>
			<div className="grid grid-cols-[max-content_max-content] w-fit gap-x-2 gap-y-[6px] items-center [&_code]:w-full mb-3">
				<div>
					<code>
						<span>{t("search.help.exact-example")}</span>
					</code>
				</div>
				<div className="text-start">
					<span>{t("search.help.exact-desc")}</span>
				</div>
				<div>
					<code>
						<span>{t("search.help.exclude-example")}</span>
					</code>
				</div>
				<div className="text-start">
					<span>{t("search.help.exclude-desc")}</span>
				</div>
				<div>
					<code>
						<span>{t("search.help.include-example")}</span>
					</code>
				</div>
				<div className="text-start">
					<span>{t("search.help.include-desc")}</span>
				</div>
			</div>
			<div className="text-xs text-start">
				<span>{t("search.help.combine-desc")}: </span>
				<code>
					<span>{t("search.help.combine-example")}</span>
				</code>
			</div>
		</Prose>
	);
};
