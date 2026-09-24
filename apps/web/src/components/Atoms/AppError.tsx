// biome-ignore lint/style/noRestrictedImports: legacy styled component, migrate to Tailwind later
import styled from "@emotion/styled";
import InfoModalForm from "@ext/errorHandlers/client/components/ErrorForm";
import type DefaultError from "@ext/errorHandlers/logic/DefaultError";
import GetErrorComponent from "@ext/errorHandlers/logic/GetErrorComponent";
import t from "@ext/localization/locale/translate";
import { WORKSPACE_ACCESS_DENIED } from "@ext/workspace/error/WorkspaceAccessDenied";
import { Dialog } from "@ui-kit/Dialog";
import type { HTMLAttributes } from "react";

const errorCodes = {
	wasmNotSupported: {
		title: "app.error.browser-not-supported.title",
		desc: "app.error.browser-not-supported.desc",
	},
	wasmInitTimeout: {
		title: "app.error.wasm-init-timeout.title",
		desc: "app.error.wasm-init-timeout.desc",
	},
	notHttps: {
		title: "app.error.cannot-load",
		desc: "app.error.not-https",
	},
	generic: {
		title: "app.error.cannot-load",
	},
};

const AppError = ({ error, ...props }: { error: DefaultError } & HTMLAttributes<HTMLDivElement>) => {
	const errorInfo = errorCodes[error.props?.errorCode] ?? errorCodes.generic;

	// A denied workspace folder is the one boot failure the user can actually act on, and the
	// actions live in its dialog. The form below can only print a message, so hand this one to
	// the same component the in-app modal uses instead of restating it here.
	if (error.props?.errorCode === WORKSPACE_ACCESS_DENIED)
		return (
			// Boot-time: there is no app behind this dialog to dismiss it to, so the only honest
			// secondary action is to try again once access has been granted. Without it the
			// non-macOS branch renders an OK button that does nothing.
			<Dialog open={true}>
				<GetErrorComponent error={error} onCancelClick={() => window.location.reload()} />
			</Dialog>
		);

	return (
		<div {...props}>
			<div className="container">
				<InfoModalForm
					icon={{ code: "circle-x", color: "var(--color-danger)" }}
					noButtons={true}
					onCancelClick={null}
					title={t(errorInfo.title)}
				>
					{errorInfo.desc ? (
						// biome-ignore lint/style/useNamingConvention: it's a html message
						<div dangerouslySetInnerHTML={{ __html: t(errorInfo.desc) }}></div>
					) : (
						(error?.message ?? t("app.error.unknown-error"))
					)}
				</InfoModalForm>
			</div>
		</div>
	);
};

const AppErrorStyled = styled(AppError)`
	.container {
		width: var(--default-form-width);
	}

	display: flex;
	height: 100%;
	width: 100%;
	align-items: center;
	justify-content: center;
`;

export default AppErrorStyled;
