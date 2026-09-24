import FileInput from "@components/Atoms/FileInput/FileInput";
import getCodeLensDefaultText from "@components/Atoms/FileInput/getCodeLenseDefaultText";
import getFileInputDefaultLanguage from "@components/Atoms/FileInput/getFileInputDefaultLanguage";
import SidebarArticleElement from "@components/Layouts/Sidebar";
import { cn } from "@core-ui/utils/cn";
import getCodeLensReversedText from "@ext/git/actions/MergeConflictHandler/error/logic/getCodeLensReversedText";
import reverseMergeStatus from "@ext/git/actions/MergeConflictHandler/logic/GitMergeStatusReverse";
import haveConflictWithFileDelete from "@ext/git/actions/MergeConflictHandler/logic/haveConflictWithFileDelete";
import FileInputMergeConflict, {
	type CodeLensText,
} from "@ext/git/actions/MergeConflictHandler/Monaco/logic/FileInputMergeConflict";
import { GitMarkers } from "@ext/git/actions/MergeConflictHandler/Monaco/logic/mergeConflictParser";
import GitMergeStatus from "@ext/git/actions/MergeConflictHandler/model/GitMergeStatus";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { Icon } from "@ui-kit/Icon";
import { Loader } from "@ui-kit/Loader";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@ui-kit/Sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import type { editor } from "monaco-editor";
import type * as monacoType from "monaco-editor/esm/vs/editor/editor.api";
import { useCallback, useEffect, useRef, useState } from "react";
import SidebarArticleLink from "../../Publish/components/SidebarArticleLink";
import type { GitMergeResultContent } from "../model/GitMergeResultContent";

interface MergeFileModel {
	mergeFile: GitMergeResultContent;
	conflictsCount: number;
	editorState: {
		textModel: editor.IModel;
		viewState: editor.ICodeEditorViewState;
	};
}

const makeDeleteConflictContent = (content: string): string => {
	return `${GitMarkers.startHeader} Deleted content\n\n${GitMarkers.splitter}\n${content}\n${GitMarkers.endFooter} Added content`;
};

const initMergeFilesModel = (mergeFiles: GitMergeResultContent[]): MergeFileModel[] => {
	return mergeFiles
		.filter((f) => f.status !== GitMergeStatus.BothDeleted)
		.map((f) => {
			const isConflictWithFileDelete = haveConflictWithFileDelete(f.status);
			const content = isConflictWithFileDelete ? makeDeleteConflictContent(f.content) : f.content;

			return {
				conflictsCount: null,
				mergeFile: { ...f, content },
				editorState: { textModel: null, viewState: null },
			};
		});
};

const getCodeLensText = (type: GitMergeStatus, reverseMerge: boolean): CodeLensText => {
	const resolvedType = reverseMerge ? reverseMergeStatus(type) : type;
	const codeLensText = reverseMerge ? getCodeLensReversedText() : getCodeLensDefaultText();
	switch (resolvedType) {
		case GitMergeStatus.AddedByThem:
			return {
				...codeLensText,
				mergeWithDeletionHeader: t("git.merge.conflict.added-by-them"),
			};
		case GitMergeStatus.AddedByUs:
			return {
				...codeLensText,
				mergeWithDeletionHeader: t("git.merge.conflict.added-by-us"),
			};
		case GitMergeStatus.DeletedByThem:
			return {
				...codeLensText,
				mergeWithDeletionHeader: t("git.merge.conflict.deleted-by-them"),
			};
		case GitMergeStatus.DeletedByUs:
			return {
				...codeLensText,
				mergeWithDeletionHeader: t("git.merge.conflict.deleted-by-us"),
			};
		default:
			return codeLensText;
	}
};

const MergeConflictHandler = ({
	rawFiles,
	onMerge,
	reverseMerge,
}: {
	rawFiles: GitMergeResultContent[];
	onMerge: (result: GitMergeResultContent[]) => void;
	reverseMerge: boolean;
}) => {
	const [mergeFilesModel, setMergeFilesModel] = useState<MergeFileModel[]>(() => initMergeFilesModel(rawFiles));
	const [selectedIdx, setSelectedIdx] = useState(0);
	const currentIdx = useRef(0);

	const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
	const monacoRef = useRef<typeof monacoType>(null);
	const fileInputMergeConflictRef = useRef<FileInputMergeConflict>(null);

	const isAllMergesResolved = mergeFilesModel.every((m) => m.conflictsCount === 0);

	const currentOnMerge = useCallback(() => {
		onMerge(mergeFilesModel.map((m) => m.mergeFile));
	}, [mergeFilesModel, onMerge]);

	const initModelsExceptFirst = () => {
		mergeFilesModel.forEach((model, idx) => {
			if (idx === 0) return;
			model.editorState.textModel = monacoRef.current.editor.createModel(
				model.mergeFile.content,
				getFileInputDefaultLanguage(),
			);
		});
	};

	const initConflictsCount = () => {
		mergeFilesModel.forEach((model) => {
			model.conflictsCount = FileInputMergeConflict.getMergeConflictDescriptor(
				monacoRef.current,
				model.editorState.textModel,
			).length;
		});
		setMergeFilesModel([...mergeFilesModel]);
	};

	useEffect(() => {
		const keydownHandler = (e: KeyboardEvent) => {
			if (e.code === "Enter" && (e.ctrlKey || e.metaKey) && isAllMergesResolved) currentOnMerge();
		};

		document.addEventListener("keydown", keydownHandler, false);
		return () => {
			document.removeEventListener("keydown", keydownHandler, false);
		};
	}, [isAllMergesResolved, currentOnMerge]);

	const handleSidebarItemClick = (idx: number) => {
		const prevIdx = currentIdx.current;
		currentIdx.current = idx;
		setSelectedIdx(idx);

		const mergeModelBefore = mergeFilesModel[prevIdx];
		if (editorRef.current && mergeModelBefore) {
			mergeModelBefore.editorState.viewState = editorRef.current.saveViewState();
		}

		const currentMergeModel = mergeFilesModel[idx];

		if (fileInputMergeConflictRef.current) {
			const isConflictWithFileDelete = haveConflictWithFileDelete(currentMergeModel.mergeFile.status);
			fileInputMergeConflictRef.current.haveConflictWithFileDelete = isConflictWithFileDelete;
			fileInputMergeConflictRef.current.codeLensText = getCodeLensText(
				currentMergeModel.mergeFile.status,
				reverseMerge,
			);
		}

		if (editorRef.current) {
			editorRef.current.setModel(currentMergeModel.editorState.textModel);
			fileInputMergeConflictRef.current?.onChange();
			editorRef.current.restoreViewState(currentMergeModel.editorState.viewState);
			editorRef.current.focus();
		}
	};

	return (
		<SidebarProvider className="h-full min-h-[unset] max-h-full overflow-hidden [&_li]:mb-0 [&_li]:leading-[unset] [&_ul]:!list-none">
			<Sidebar className="h-full" collapsible="none" data-qa={`article-git-modal`}>
				<SidebarContent className="left-sidebar">
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{mergeFilesModel.map((model, idx) => {
									const isLoading = model.conflictsCount === null;
									const haveConflict = model.conflictsCount > 0;
									const conflictIndicator = (
										<span
											className={cn(
												"flex items-center gap-0.5",
												haveConflict ? "text-status-error" : "text-status-success",
											)}
										>
											<Icon icon={haveConflict ? "circle-x" : "check"} size="sm" />
											{haveConflict && (
												<span className="text-[10px]">{model.conflictsCount}</span>
											)}
										</span>
									);
									const conflictCounterOrCheck = haveConflict ? (
										<Tooltip>
											<TooltipTrigger asChild>{conflictIndicator}</TooltipTrigger>
											<TooltipContent>{t("git.merge.conflict.conflicts")}</TooltipContent>
										</Tooltip>
									) : (
										conflictIndicator
									);
									return (
										<SidebarMenuItem key={model.mergeFile.path}>
											<SidebarMenuButton
												className="h-auto"
												isActive={selectedIdx === idx}
												onClick={() => handleSidebarItemClick(idx)}
											>
												<div className="flex w-full items-center justify-between gap-2">
													<div className="overflow-hidden">
														<SidebarArticleElement title={model.mergeFile.title} />
														<SidebarArticleLink filePath={{ path: model.mergeFile.path }} />
													</div>
													{isLoading ? null : conflictCounterOrCheck}
												</div>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter className="left-sidebar-footer">
					<div className="p-4">
						<Button
							className="w-full"
							disabled={!isAllMergesResolved}
							onClick={currentOnMerge}
							variant="primary"
						>
							{t("confirm")}
						</Button>
					</div>
				</SidebarFooter>
			</Sidebar>
			<main className="w-full max-w-full overflow-hidden">
				<div className="flex-1 h-full">
					<FileInput
						height={"100%"}
						loading={<Loader size="lg" />}
						onChange={(value) => {
							mergeFilesModel[currentIdx.current].mergeFile.content = value;
							const mergeConflictDescriptor =
								fileInputMergeConflictRef.current?.mergeConfilctDescriptor ?? [];
							mergeFilesModel[currentIdx.current].conflictsCount = mergeConflictDescriptor.length;
							setMergeFilesModel([...mergeFilesModel]);
						}}
						onMount={(e, m, fileInputMergeConflict) => {
							editorRef.current = e;
							monacoRef.current = m;
							fileInputMergeConflictRef.current = fileInputMergeConflict;

							mergeFilesModel[0].editorState.textModel = e.getModel();
							mergeFilesModel[0].editorState.viewState = e.saveViewState();
							e.focus();

							initModelsExceptFirst();
							initConflictsCount();

							if (fileInputMergeConflictRef.current) {
								const isConflictWithFileDelete = haveConflictWithFileDelete(
									mergeFilesModel[0].mergeFile.status,
								);
								fileInputMergeConflictRef.current.haveConflictWithFileDelete = isConflictWithFileDelete;
								fileInputMergeConflictRef.current.codeLensText = getCodeLensText(
									mergeFilesModel[0].mergeFile.status,
									reverseMerge,
								);
							}
						}}
						style={{ padding: "unset" }}
						value={mergeFilesModel[0].mergeFile.content}
					/>
				</div>
			</main>
		</SidebarProvider>
	);
};

export default MergeConflictHandler;
