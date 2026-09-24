import GesCloudAiWalletComponent, {
	type GesCloudAiWalletComponentProps,
} from "@ext/enterprise-cloud/components/organizationSettings/settings/ai-wallet/GesCloudAiWalletComponent";
import GesCloudBillingComponent, {
	type GesCloudBillingComponentProps,
} from "@ext/enterprise-cloud/components/organizationSettings/settings/billing/GesCloudBillingComponent";
import GesCloudUsersComponent, {
	type GesCloudUsersComponentProps,
} from "@ext/enterprise-cloud/components/organizationSettings/settings/members/GesCloudMembersComponent";
import GesCloudOrganizationComponent from "@ext/enterprise-cloud/components/organizationSettings/settings/organization/GesCloudOrganizationComponent";
import GesCloudPaymentMethodsComponent, {
	type GesCloudPaymentMethodsComponentProps,
} from "@ext/enterprise-cloud/components/organizationSettings/settings/paymentMethods/GesCloudPaymentMethodsComponent";
import GesCloudTokensComponent from "@ext/enterprise-cloud/components/organizationSettings/settings/tokens/GesCloudTokensComponent";
import GesCloudOrgSettingsPage from "@ext/enterprise-cloud/types/GesCloudOrgSettingsPage";
import type { ReactNode } from "react";
import GesCloudDocumentsComponent from "./settings/documents/GesCloudDocumentsComponent";
import GesCloudReposComponent from "./settings/repos/GesCloudReposComponents";

type PageRenderer = (props: unknown) => ReactNode;

export const PageComponents: Record<GesCloudOrgSettingsPage, PageRenderer> = {
	[GesCloudOrgSettingsPage.ORGANIZATION]: () => <GesCloudOrganizationComponent />,
	[GesCloudOrgSettingsPage.MEMBERS]: ({ subscription, refreshSubscription }: GesCloudUsersComponentProps) => (
		<GesCloudUsersComponent refreshSubscription={refreshSubscription} subscription={subscription} />
	),
	[GesCloudOrgSettingsPage.BILLING]: ({ subscription, refreshSubscription }: GesCloudBillingComponentProps) => (
		<GesCloudBillingComponent refreshSubscription={refreshSubscription} subscription={subscription} />
	),
	[GesCloudOrgSettingsPage.PAYMENT_METHODS]: ({ subscription }: GesCloudPaymentMethodsComponentProps) => (
		<GesCloudPaymentMethodsComponent subscription={subscription} />
	),
	[GesCloudOrgSettingsPage.REPOS]: () => <GesCloudReposComponent />,
	[GesCloudOrgSettingsPage.AI_WALLET]: ({ subscription }: GesCloudAiWalletComponentProps) => (
		<GesCloudAiWalletComponent subscription={subscription} />
	),
	[GesCloudOrgSettingsPage.TOKENS]: () => <GesCloudTokensComponent />,
	[GesCloudOrgSettingsPage.DOCUMENTS]: () => <GesCloudDocumentsComponent />,
};
