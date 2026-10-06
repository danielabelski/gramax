import GifImage from "@components/Atoms/Image/GifImage";
import Image from "@components/Atoms/Image/Image";
import HoverableActions from "@components/controls/HoverController/HoverableActions";
import Path from "@core/FileProvider/Path/Path";
import ArticleRefService from "@core-ui/ContextServices/ArticleRef";
import { ResourceError } from "@core-ui/ContextServices/ResourceService/errors";
import { useGetResource } from "@core-ui/ContextServices/ResourceService/hooks/useGetResource";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import useElementInViewport from "@core-ui/hooks/useElementInViewport";
import { isExternalLink } from "@core-ui/hooks/useExternalLink";
import { cn } from "@core-ui/utils/cn";
import getAdjustedSize from "@core-ui/utils/getAdjustedSize";
import { ArticleComponentResizer } from "@ext/article/Components/ArticleComponentResizer";
import BlockCommentView from "@ext/markdown/elements/comment/edit/components/View/BlockCommentView";
import { isNonCropped } from "@ext/markdown/elements/image/edit/logic/imageEditorMethods";
import type { Crop, ImageObject } from "@ext/markdown/elements/image/edit/model/imageEditorTypes";
import ImageError from "@ext/markdown/elements/image/render/components/ImageError";
import { ImageSkeleton } from "@ext/markdown/elements/image/render/components/ImageSkeleton";
import ObjectRenderer from "@ext/markdown/elements/image/render/components/ObjectRenderer";
import useImageDecoded from "@ext/markdown/elements/image/render/hooks/useImageDecoded";
import { cropImage } from "@ext/markdown/elements/image/render/logic/cropImage";
import type { Attrs } from "@tiptap/pm/model";
import {
	type CSSProperties,
	createContext,
	forwardRef,
	memo,
	type ReactElement,
	type ReactEventHandler,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface ImageContextType {
	imageContainerRef: RefObject<HTMLDivElement>;
	mainContainerRef: RefObject<HTMLDivElement>;
	imgRef: RefObject<HTMLImageElement>;
	attrs: Attrs;
	isLoaded: boolean;
}

export const ImageContext = createContext<ImageContextType>({
	imageContainerRef: null,
	mainContainerRef: null,
	imgRef: null,
	attrs: null,
	isLoaded: false,
});

interface ImageRProps {
	src: string;
	onError: ReactEventHandler<HTMLImageElement>;
	openEditor?: () => void;
}

const IMAGE_ACTIONS_OPTIONS = {
	comment: true,
	float: true,
};

const ImageR = forwardRef<HTMLImageElement, ImageRProps>((props, ref) => {
	const { src, onError, openEditor } = props;
	const {
		attrs: { id, title, alt, objects, width, src: realSrc },
		isLoaded,
		imageContainerRef,
	} = useContext(ImageContext);

	return (
		<div className="image-container flex max-w-full relative justify-center rounded-sm" data-focusable="true">
			<Image
				alt={alt}
				id={id}
				modalEdit={openEditor}
				modalTitle={title}
				objects={objects}
				onError={onError}
				realSrc={realSrc}
				ref={ref}
				src={src}
			/>
			<div className="object-container isolate">
				{isLoaded && (
					<ObjectRenderer
						editable={false}
						imageRef={ref as RefObject<HTMLImageElement>}
						objects={objects}
						originalWidth={width}
						parentRef={imageContainerRef}
					/>
				)}
			</div>
		</div>
	);
});

interface ImageProps {
	realSrc: string;
	src?: string;
	noEm?: boolean;
	openEditor?: () => void;
	setSrc?: (newSrc: Blob) => void;
	alt?: string;
	title?: string;
	crop?: Crop;
	objects?: ImageObject[];
	id?: string;
	style?: CSSProperties;
	scale?: number | string;
	className?: string;
	onError?: ReactEventHandler<HTMLImageElement>;
	hoverElementRef?: RefObject<HTMLDivElement>;
	getBuffer?: (src: string) => Buffer;
	updateAttributes?: (attributes: Attrs, transaction?: boolean) => void;
	width?: string;
	height?: string;
	showResizer?: boolean;
	isHovered?: boolean;
	setIsHovered?: (isHovered: boolean) => void;
	rightActions?: ReactElement;
	commentId?: string;
	float?: string;
	hasParentPath?: boolean;
	isPrint?: boolean;
	renderSrc?: string;
}

const ImageRenderer = memo((props: ImageProps): ReactElement => {
	const {
		openEditor,
		id,
		realSrc,
		alt,
		crop,
		title,
		className,
		scale,
		updateAttributes,
		width,
		height,
		objects,
		noEm,
		showResizer,
		hoverElementRef,
		isHovered,
		setIsHovered,
		rightActions,
		commentId,
		float,
		hasParentPath = true,
		isPrint,
		renderSrc: propRenderSrc,
	} = props;
	const renderSrc = isPrint ? null : propRenderSrc;

	const [error, setError] = useState<ResourceError | null>(null);
	const isNonCroppedValue = isNonCropped(crop);
	const shouldSkipLoadResource = renderSrc && isNonCroppedValue;

	const articleRef = ArticleRefService.value;

	const [imageSrc, setImageSrc] = useState<string>(isNonCroppedValue ? renderSrc || null : null);

	const intrinsicSize = useMemo(() => {
		if (!width?.endsWith("px") || !height) return null;
		const croppedW = parseFloat(width) * ((crop?.w ?? 100) / 100);
		const croppedH = parseFloat(height) * ((crop?.h ?? 100) / 100);
		if (!croppedW || !croppedH) return null;
		return { width: croppedW, height: croppedH };
	}, [width, height, crop]);

	const size = useMemo(() => {
		const parentWidth = articleRef?.current?.firstElementChild?.firstElementChild?.clientWidth ?? 0;
		if (!intrinsicSize || !parentWidth) return null;

		const adjusted = getAdjustedSize(intrinsicSize.width, intrinsicSize.height, parentWidth, scale);
		return { width: `${adjusted.width}px`, height: `${adjusted.height}px` };
	}, [intrinsicSize, scale]);

	const isGif = new Path(realSrc).extension === "gif";
	const { getBuffer } = ResourceService.value;

	const mainContainerRef = useRef<HTMLDivElement>(null);
	const imageContainerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const isLoaded = useImageDecoded(imgRef, imageSrc);
	const reservesLayout = !isLoaded && !!intrinsicSize;
	const usesFallbackLayout = !intrinsicSize && !isLoaded && !error;

	// Fetch the image resource only once it scrolls near the viewport, so an article with many
	// images no longer loads every resource up front. Print/export and GIFs load eagerly: print
	// needs all resources ready for pagination, and the GIF branch renders without mainContainerRef.
	const isInViewport = useElementInViewport(mainContainerRef, {
		rootMargin: "1500px 0px",
		enabled: !isPrint && !isGif,
	});

	const onError: ReactEventHandler<HTMLImageElement> = useCallback(() => {
		setError(new ResourceError("Image error", realSrc));
	}, [realSrc]);

	const setSrc = useCallback((newSrc: Blob) => {
		setImageSrc((prev) => {
			if (prev) {
				URL.revokeObjectURL(prev);
			}
			const url = URL.createObjectURL(newSrc);
			return url;
		});
	}, []);

	const cropImg = useCallback(
		async (buffer: Buffer, crop: Crop, signal?: AbortSignal) => {
			const container = mainContainerRef.current;
			const croppedBlob = await cropImage(container, crop, realSrc, buffer);
			if (signal?.aborted) return;
			setSrc(croppedBlob);
		},
		[realSrc, setSrc],
	);

	const saveResize = useCallback(
		(scale: string) => {
			updateAttributes?.({ scale });
		},
		[updateAttributes],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		if (!isLoaded || renderSrc) return;
		const buffer = getBuffer(realSrc);

		if (!buffer) return;
		void cropImg(buffer, crop);
	}, [crop]);

	const externalLink = useMemo(() => {
		if (!shouldSkipLoadResource) return;
		if (isExternalLink(renderSrc).isUrl || typeof document === "undefined") return renderSrc;
		return new URL(renderSrc, document.baseURI).href;
	}, [renderSrc, shouldSkipLoadResource]);

	useGetResource(
		async (buffer, resourceError, signal) => {
			if (resourceError || !buffer || !buffer.byteLength) {
				setError(resourceError ?? new ResourceError("Image error", realSrc));
				return;
			}
			await cropImg(buffer, crop, signal);
		},
		externalLink || realSrc,
		undefined,
		hasParentPath,
		isPrint,
		shouldSkipLoadResource || !isInViewport,
	);

	if (isGif) {
		return (
			<BlockCommentView commentId={commentId}>
				{error ? (
					<ImageError height={height} resourceError={error} width={width} />
				) : (
					<GifImage
						alt={title}
						height={height}
						hoverElementRef={hoverElementRef}
						isHovered={isHovered}
						onError={onError}
						realSrc={realSrc}
						rightActions={rightActions}
						setIsHovered={setIsHovered}
						src={imageSrc}
						title={noEm ? "" : title}
						width={width}
					/>
				)}
			</BlockCommentView>
		);
	}

	return (
		<ImageContext.Provider
			value={{
				imageContainerRef,
				mainContainerRef,
				imgRef,
				attrs: {
					id,
					width: size?.width,
					height: size?.height,
					crop,
					scale,
					title,
					alt,
					objects,
					src: realSrc,
				},
				isLoaded,
			}}
		>
			<div
				className={cn(
					"[page-break-inside:avoid] break-inside-avoid select-none box-border mb-[0.5em]",
					className,
				)}
				data-component="image"
				data-float={float && !openEditor ? float : undefined}
				data-resize-container={float && !openEditor ? true : undefined}
				data-testid="image"
			>
				<ArticleComponentResizer
					disabled={!isLoaded || !openEditor}
					isPrint={isPrint}
					onChange={saveResize}
					scale={scale}
					selected={showResizer}
				>
					<div className="flex w-full" ref={mainContainerRef}>
						<HoverableActions
							actionsOptions={IMAGE_ACTIONS_OPTIONS}
							hoverElementRef={hoverElementRef}
							isHovered={isHovered}
							rightActions={error ? undefined : rightActions}
							setIsHovered={setIsHovered}
						>
							<div className="relative w-full [&_img]:select-none [&_img]:w-full" ref={imageContainerRef}>
								<BlockCommentView className="rounded-sm" commentId={commentId}>
									{reservesLayout && (
										<svg
											aria-hidden
											className="block h-auto w-full"
											data-image-placeholder
											height={intrinsicSize.height}
											width={intrinsicSize.width}
										/>
									)}
									<ImageSkeleton
										className={cn("rounded-sm", reservesLayout && "absolute inset-0")}
										height={reservesLayout ? undefined : size?.height}
										isLoaded={!!error || isLoaded}
										layoutReserved={reservesLayout}
										style={usesFallbackLayout ? { minHeight: "12em" } : undefined}
										width={reservesLayout ? undefined : size?.width}
									>
										{error ? (
											<ImageError
												height={size?.height}
												resourceError={error}
												width={size?.width}
											/>
										) : (
											<ImageR
												onError={onError}
												openEditor={openEditor}
												ref={imgRef}
												src={imageSrc}
											/>
										)}
									</ImageSkeleton>
								</BlockCommentView>
							</div>
						</HoverableActions>
					</div>
				</ArticleComponentResizer>
				{title && !noEm && <em>{title}</em>}
			</div>
		</ImageContext.Provider>
	);
});

export default ImageRenderer;
