import type { HomePageBreadcrumb } from "@core/SitePresenter/SitePresenter";
import t from "@ext/localization/locale/translate";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@ui-kit/Breadcrumb";
import { Fragment } from "react";

export interface BreadcrumbTrailProps {
	items: HomePageBreadcrumb[];
	onNavigate: (item: HomePageBreadcrumb, index: number) => void;
}

const BreadcrumbTrail = ({ items, onNavigate }: BreadcrumbTrailProps) => (
	<Breadcrumb>
		<BreadcrumbList className="list-none">
			{items.map((b, index) => (
				<Fragment key={b.title || index}>
					<BreadcrumbItem>
						{index !== items.length - 1 ? (
							<BreadcrumbLink
								className="font-light text-[color:var(--color-home-card-link)]"
								onClick={() => onNavigate(b, index)}
							>
								{index === 0 ? t("home") : b.title}
							</BreadcrumbLink>
						) : (
							<BreadcrumbPage>{b.title}</BreadcrumbPage>
						)}
					</BreadcrumbItem>
					{index !== items.length - 1 && (
						<BreadcrumbSeparator>
							<span className="text-muted">/</span>
						</BreadcrumbSeparator>
					)}
				</Fragment>
			))}
		</BreadcrumbList>
	</Breadcrumb>
);

export default BreadcrumbTrail;
