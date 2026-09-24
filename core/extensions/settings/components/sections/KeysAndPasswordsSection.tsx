import AgentSecretsSection from "@ext/agent/components/settings/AgentSecretsSection";

// Bypasses SectionContainer/FormBody on purpose. FormBody is ics-ui-kit's ScrollShadowContainer:
// it adds an unstyled auto-height inner div, and SectionContainer also inserts FormStack. Together
// they break the flex/min-h-0 chain needed for only the table to scroll while title/toolbar stay fixed.
// This tab mirrors admin Users/Groups tables, so it owns the bounded-height layout and only repeats
// FormBody's padding here.
const KeysAndPasswordsSection = () => {
	return (
		<div className="flex h-full min-h-0 flex-col px-5 pt-5">
			<AgentSecretsSection />
		</div>
	);
};

export default KeysAndPasswordsSection;
