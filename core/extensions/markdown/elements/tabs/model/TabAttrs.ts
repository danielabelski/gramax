import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import type { PropertyValue } from "@ext/properties/models";

interface TabAttrs {
	name?: string;
	icon?: IconCode;
	tag?: string;
	idx?: number;
	property?: PropertyValue[];
}

export default TabAttrs;
