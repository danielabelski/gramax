import AlertError from "@components/AlertError";
import { cn } from "@core-ui/utils/cn";
import t from "@ext/localization/locale/translate";
import { PanelEmptyStateIcon } from "@ui-kit/FloatingPanel";
import ErrorText from "./ErrorText";

interface ErrorVideoProps {
	isLink: boolean;
	link: string;
	className?: string;
	isNoneError?: boolean;
}

const ErrorVideo = ({ isLink, link, className, isNoneError = false }: ErrorVideoProps) => {
	if (!isNoneError) {
		return <AlertError error={{ message: t("alert.video.path") }} title={t("alert.video.unavailable")} />;
	}

	return (
		<section
			aria-label={t("editor.video.will-be-here")}
			className={cn(
				"error-video flex aspect-video min-h-[12em] w-full items-center justify-center overflow-y-auto rounded-lg border border-dashed border-secondary-border bg-primary-bg px-6 py-8 text-primary-fg",
				className,
			)}
			data-focusable="true"
			data-video-placeholder
		>
			<div className="flex max-w-[34em] flex-col items-center gap-4 text-center">
				<PanelEmptyStateIcon aria-hidden className="size-12 [&>svg]:size-6" icon="video" />
				<div className="space-y-2">
					<div className="text-base font-medium leading-6">{t("editor.video.will-be-here")}</div>
					<div className="text-left text-sm leading-6 text-secondary-fg [&_li]:pl-1 [&_ul]:m-0 [&_ul]:space-y-1 [&_ul]:pl-5">
						<ErrorText isLink={isLink} isNoneError={isNoneError} link={link} />
					</div>
				</div>
			</div>
		</section>
	);
};

export default ErrorVideo;
