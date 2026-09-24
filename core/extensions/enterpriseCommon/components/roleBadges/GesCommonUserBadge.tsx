import { Badge } from "@ui-kit/Badge";

export const GesCommonUserBadge = ({ label, icon }: { label: string; icon?: string }) => {
	return (
		<Badge focus="low" size="sm" startIcon={icon ?? ""}>
			{label}
		</Badge>
	);
};
