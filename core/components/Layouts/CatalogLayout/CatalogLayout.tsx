import { cn } from "@core-ui/utils/cn";
// biome-ignore lint/style/noRestrictedImports: tailwind migration is out of scope
import styled from "@emotion/styled";
import type { ReactNode } from "react";

const CatalogLayout = styled(({ children, className }: { children: ReactNode; className?: string }) => {
	return <div className={cn("catalog-layout", className)}>{children}</div>;
})`
	width: 100%;
	height: 100%;
	display: flex;

	@page {
		size: auto;
	}

	@media print {
		overflow: visible;
		height: auto;

		.left-nav-wrapper,
		.right-nav-wrapper {
			display: none !important;
		}

		.article-fixed-container {
			height: auto !important;
			overflow: visible !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
		}

		* {
			overflow: visible !important;
			transition: none !important;
		}
	}
`;

export default CatalogLayout;
