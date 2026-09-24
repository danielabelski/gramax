import type GetErrorComponent from "@ext/errorHandlers/logic/GetErrorComponent";
import WorkspaceAccessDeniedError from "@ext/workspace/error/components/WorkspaceAccessDeniedError";
import { WORKSPACE_ACCESS_DENIED } from "@ext/workspace/error/WorkspaceAccessDenied";
import type { ComponentProps, ReactNode } from "react";

const getWorkspaceErrors = (): { [key: string]: (args: ComponentProps<typeof GetErrorComponent>) => ReactNode } => ({
	[WORKSPACE_ACCESS_DENIED]: WorkspaceAccessDeniedError,
});

export default getWorkspaceErrors;
