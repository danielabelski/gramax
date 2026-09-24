import Date from "@components/Atoms/Date";
import Icon from "@components/Atoms/Icon";
import Tooltip from "@components/Atoms/Tooltip";
import UserCircle from "@components/Atoms/UserCircle";
import type { DateType } from "@core-ui/utils/dateUtils";
// biome-ignore lint/style/noRestrictedImports: pre-existing @emotion/styled import; the Tailwind migration is not this change's scope
import styled from "@emotion/styled";

interface UserProps {
	name: string;
	mail?: string;
	date?: DateType;
	className?: string;
}

const InlineUser = ({ name, mail, date, className }: UserProps) => {
	return (
		<div className={className}>
			<span className="user-circle">
				<UserCircle name={name || "Unknown"} />
			</span>
			<Tooltip appendTo={() => document.body} content={mail} delay="long" interactive>
				<span className="user-name">{name}</span>
			</Tooltip>
			{date && (
				<>
					<span className="dot-divider">
						<Icon code="dot" />
					</span>
					<Date date={date} tooltipDelay="long" />
				</>
			)}
		</div>
	);
};

export default styled(InlineUser)`
	display: flex;
	align-items: center;
	gap: 0.3rem;
`;
