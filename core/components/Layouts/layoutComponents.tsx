import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { RightNavigationButton } from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigationButton";
import type { TitledLink } from "@ext/navigation/NavigationLinks";
import { Divider } from "@ui-kit/Divider";
import type { ReactNode } from "react";
import { tv } from "tailwind-variants";

interface RenderTitledLinks {
	links: TitledLink[];
	isCatalog?: boolean;
}

const listStyles = tv({
	base: "!pl-0 text-sm leading-normal list-none",
});

const anchorStyles = tv({
	base: "layout_link inline-flex font-light no-underline w-full",
});

const childrenSpanStyles = tv({
	base: "inline-flex text-sm leading-normal [&_a]:mr-[0.3em] [&_a]:ml-[0.3em] ![&_a:first-of-type]:ml-0 ![&_a:last-child]:mr-0",
});

const RenderTitledLink = ({ link }: { link: TitledLink }): JSX.Element => {
	return (
		<a
			className={anchorStyles()}
			data-qa="qa-clickable"
			href={link.url}
			rel="noreferrer"
			target={link.target ?? "_blank"}
		>
			<RightNavigationButton fullWidth startIcon={link.icon as IconCode}>
				{link.title}
			</RightNavigationButton>
			{link.childrens && (
				<span className={childrenSpanStyles()}>
					<RenderTitledLinks links={link.childrens} />
				</span>
			)}
		</a>
	);
};

const RenderTitledLinks = ({ links, isCatalog }: RenderTitledLinks): ReactNode => {
	return links.map((link) =>
		!Object.keys(link).length ? (
			<Divider className="divider" key={link.url} />
		) : (
			<li
				className="!mb-0 !leading-none"
				data-qa={`${isCatalog ? "catalog" : "article"}-${link.icon}-button`}
				key={link.url}
				onClick={link.onClick}
			>
				<RenderTitledLink link={link} />
			</li>
		),
	);
};

const Links = (props: {
	articleLinks?: TitledLink[];
	catalogLinks?: TitledLink[];
	articleChildren?: JSX.Element;
	catalogChildren?: JSX.Element;
	isCatalogActionsVisible?: boolean;
	className?: string;
}) => {
	const {
		articleLinks = [],
		articleChildren,
		catalogLinks = [],
		catalogChildren,
		isCatalogActionsVisible,
		className,
	} = props;
	return (
		<>
			<ul className={listStyles({ className })}>
				<RenderTitledLinks isCatalog={false} links={articleLinks} />
				{articleChildren}
			</ul>
			{catalogLinks?.length || isCatalogActionsVisible ? <Divider /> : null}
			<ul className="!mt-0 !mb-0 !pl-5 !-ml-5 list-none">
				<RenderTitledLinks isCatalog={true} links={catalogLinks} />
				{catalogChildren}
			</ul>
		</>
	);
};

export default Links;
