import { getExecutingEnvironment } from "@app/resolveModule/env";
import resolveModule from "@app/resolveModule/frontend";
import type UserSettings from "@ext/enterprise/types/UserSettings";
import type { GesCloudInvoice } from "@ext/enterprise-cloud/components/organizationSettings/settings/documents/types/GesCloudDocumentsComponentTypes";
import type { GesCloudMember } from "@ext/enterprise-cloud/components/organizationSettings/settings/members/types/GesCloudUsersComponentTypes";
import type { GesCloudCatalogInitData } from "@ext/enterprise-cloud/types/GesCloudCatalogInitData";
import type { AccessTokenItem } from "@ext/enterpriseCommon/components/accessTokens/types/AccessTokensComponentTypes";
import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import t from "@ext/localization/locale/translate";
import type UserInfo from "@ext/security/logic/User/UserInfo";
import type { ResourcesSettings } from "../enterprise/components/admin/settings/resources/types/ResourcesComponent";
import type { Settings } from "../enterprise/types/EnterpriseAdmin";
import type { UserCatalogPropsSet } from "../enterpriseCommon/logic/user/UserCatalogProps";
import type { MoneyValue } from "./types/MoneyValue";

interface GetMembersResponse {
	members: GesCloudMember[];
}

export interface GesCloudUserWithPermissions {
	info: UserInfo;
	workspacePermissions: string[];
	catalogsPermissions: { [catalogName: string]: string[] };
	catalogsProps: UserCatalogPropsSet;
}

interface GetInvoicesResponse {
	invoices: GesCloudInvoice[];
}

export interface OrganizationInfo {
	id: string;
	name: string;
	redirectUrl: string;
	current: boolean;
	apiUrl: string;
	canEdit?: boolean;
}

interface GetUserOrganizationsResponse {
	organizations: OrganizationInfo[];
}

export interface Organization {
	id: string;
	name: string;
}

interface GetOrganizationResponse {
	organization: Organization;
}

export interface GetCatalogRepositoryNameResponse {
	repositoryName: string;
	isRepositoryNameAlreadyExists: boolean;
}

export type SubscriptionStatusCode = "active" | "past_due" | "suspended";
export type SubscriptionPlanCode = "free" | "paid";
export type BillingPeriodCode = "month" | "year";
export type BillingModeCode = "individual" | "legal_entity";
export type PaymentChannelCode = "online_payment" | "bank_transfer";

export interface GesCloudSubscription {
	status: SubscriptionStatusCode;
	plan: SubscriptionPlanCode;
	billingPeriod: BillingPeriodCode | null;
	billingMode: BillingModeCode;
	seatsInfo: {
		maxSeats: number;
		freeSeatsLimit: number;
		occupiedSeats: number;
	};
	currency: string;
	nextChargeAt: string | null;
	nextChargeAmount: string;
	willBecomeFree: boolean;
	currentPeriodEnd: string | null;
	cancelScheduledAt: string | null;
	hasPaymentMethod: boolean;
}

export interface GesCloudPayment {
	date: string;
	kind: string;
	amount: string;
	currency: string;
	status: string;
}

export interface GesCloudTariff {
	planCode: string;
	billingPeriod: string;
	monthsPerPeriod: number;
	pricePerMonth: MoneyValue;
	paymentPerPeriod: string;
	currency: string;
}

export interface GesCloudTariffs {
	tariffs: GesCloudTariff[];
}

export interface GesCloudPaymentInfo {
	paymentPerPeriod: string;
	editorsCount: number;
	payNowAmount: string;
	currency: string;
	billingPeriod: string;
}

export interface GesCloudChangePeriodPaymentInfo {
	editorsCount: number;
	pricePerEditorPerPeriod: MoneyValue;
	paymentPerPeriod: string;
	payNowAmount: MoneyValue;
	currency: string;
	billingPeriod: string;
	prorationCredit: MoneyValue;
}

export type GesCloudRecoverPaymentInfo =
	| {
			type: "recoverPaid";
			editorsCount: number;
			pricePerEditorPerPeriod: string;
			paymentPerPeriod: string;
			payNowAmount: string;
			currency: string;
			billingPeriod: string;
	  }
	| {
			type: "resetToFree";
			editorsCount: number;
			freeSeatsLimit: number;
	  };

export type RecoverFromSuspendedResult =
	| { status: "ok" }
	| { status: "pending" }
	| { status: "invoice"; invoiceId: string };

export type ChangeBillingPeriodResult =
	| { status: "reserved" }
	| { status: "pending" }
	| { status: "invoice"; invoiceId: string };

export interface GesCloudPaymentMethodCard {
	last4: string;
	expiryMonth: string;
	expiryYear: string;
	cardType: string;
}

export interface GesCloudPaymentMethod {
	id: string;
	type: "bank_card";
	isDefault: boolean;
	title: string | null;
	card: GesCloudPaymentMethodCard | null;
}

export type PaymentMethodBindingStatus = "none" | "pending" | "active" | "inactive";

export interface BindPaymentMethodResult {
	status: "redirect";
	confirmationUrl: string;
}

export type PurchaseSeatResult =
	| { status: "reserved" }
	| { status: "pending" }
	| { status: "redirect"; redirectUrl?: string; paymentId?: string }
	| { status: "invoice"; invoiceId: string };

export interface GesCloudInvoicePdf {
	data: Blob;
	fileName: string;
}

export interface GesCloudAiWallet {
	balance: string;
	currency: string;
	billingMode: BillingModeCode;
}

export type TopUpAiWalletResult =
	| { status: "succeeded" }
	| { status: "pending" }
	| { status: "redirect"; redirectUrl?: string; paymentId?: string }
	| { status: "invoice"; invoiceId: string };

export type BillingRequisitesInput =
	| {
			type: "company";
			documentEmail: string;
			inn: string;
			kpp: string;
	  }
	| {
			type: "individual_entrepreneur";
			documentEmail: string;
			inn: string;
			kpp?: unknown;
	  };

export type FoundBillingRequisites = BillingRequisitesInput & {
	fullName: string;
	registeredAddress: string;
};

export type GesCloudAiAgentHealthcheckResult =
	| { available: true }
	| { available: false; reason: "balance_empty" | "unavailable" };

export class GesCloudApi {
	private _gesCloudUrl: string;
	private readonly _fetchMode: "desktop" | "web" = "web";

	static async getCloudInstanceUrl(): Promise<string | undefined> {
		try {
			const response = await fetch("https://gram.ax/cloud-instance.txt");
			if (!response.ok) return;

			const url = (await response.text()).trim();
			if (!URL.canParse(url)) return;

			return url;
		} catch {
			return;
		}
	}

	constructor(gesCloudUrl: string) {
		this._gesCloudUrl = gesCloudUrl.endsWith("/") ? gesCloudUrl.slice(0, -1) : gesCloudUrl;
		if (getExecutingEnvironment() === "tauri") this._fetchMode = "desktop";
	}

	async healthcheckAiAgent(): Promise<GesCloudAiAgentHealthcheckResult> {
		try {
			const res = await this._fetch(`${this._gesCloudUrl}/ai-agent/healthcheck`, {
				method: "GET",
				credentials: "include",
			});
			if (res.status === 402) return { available: false, reason: "balance_empty" };
			if (!res.ok) return { available: false, reason: "unavailable" };

			const data = (await res.json()) as { type?: string };
			return data?.type === "ok" ? { available: true } : { available: false, reason: "unavailable" };
		} catch {
			return { available: false, reason: "unavailable" };
		}
	}

	async getCatalogInitData(): Promise<GesCloudCatalogInitData> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/catalog/get-init-data`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
		});
		if (!res.ok) throw new Error(`Failed to get catalog init data: ${res.status}`);
		return res.json();
	}

	async getCatalogRepositoryName(
		catalogTitle: string,
		localCatalogRepositoryNames: string[],
	): Promise<GetCatalogRepositoryNameResponse> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/catalog/repository-name`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ catalogTitle, localCatalogRepositoryNames }),
			credentials: "include",
		});
		if (!res.ok) throw new Error(`Failed to get catalog repository name: ${res.status}`);

		const data: GetCatalogRepositoryNameResponse = await res.json();
		return data;
	}

	async inviteMember(email: string): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/members/invite`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to invite user: ${res.status}`);
		}
	}

	async getMembers(): Promise<GesCloudMember[]> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/members/get`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get members: ${res.status}`);
		}

		const data: GetMembersResponse = await res.json();
		return data.members;
	}

	async getSubscription(): Promise<GesCloudSubscription> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/subscription`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get subscription: ${res.status}`);
		}

		return res.json();
	}

	async getPayments(): Promise<GesCloudPayment[]> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/payments`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get payments: ${res.status}`);
		}

		const data: { payments: GesCloudPayment[] } = await res.json();
		return data.payments;
	}

	async getTariffs(): Promise<GesCloudTariffs> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/tariffs`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get tariffs: ${res.status}`);
		}

		return res.json();
	}

	async getInvoices(): Promise<GesCloudInvoice[]> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/legal-entity/invoices/get`,
			{
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to get invoices: ${res.status}`);
		}

		const data: GetInvoicesResponse = await res.json();
		return data.invoices;
	}

	async getPrePurchaseSeatsInfo(
		seatsCount: number,
		billingPeriod?: string,
		signal?: AbortSignal,
	): Promise<GesCloudPaymentInfo> {
		const query = new URLSearchParams({ seatsCount: String(seatsCount) });
		if (billingPeriod) query.set("billingPeriod", billingPeriod);

		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/seats/purchase/info?${query.toString()}`,
			{ credentials: "include", signal },
		);

		if (!res.ok) {
			throw new Error(`Failed to get payment info: ${res.status}`);
		}

		return res.json();
	}

	async purchaseSeat(
		idempotenceKey: string,
		payload: {
			totalSeatsCount: number;
			billingPeriod?: string;
			returnUrl?: string;
			paymentChannel: PaymentChannelCode;
		},
	): Promise<PurchaseSeatResult> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/seats/purchase`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Idempotence-Key": idempotenceKey,
			},
			body: JSON.stringify({
				totalSeatsCount: payload.totalSeatsCount,
				billingPeriod: payload.billingPeriod,
				returnUrl: payload.returnUrl,
				paymentChannel: payload.paymentChannel,
			}),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to purchase seat: ${res.status}`);
		}

		return res.json();
	}

	async getInvoicePdf(invoiceId: string): Promise<GesCloudInvoicePdf> {
		const query = new URLSearchParams({ invoiceId });
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/legal-entity/invoices/pdf?${query.toString()}`,
			{ credentials: "include" },
		);

		if (!res.ok) {
			throw new Error(`Failed to get invoice PDF: ${res.status}`);
		}

		return {
			data: await res.blob(),
			fileName: this._getInvoiceFileName(res.headers.get("Content-Disposition"), invoiceId),
		};
	}

	async getAiWallet(): Promise<GesCloudAiWallet> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/ai-wallet`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get ai wallet: ${res.status}`);
		}

		return res.json();
	}

	async topUpAiWallet(
		idempotenceKey: string,
		payload: { amount: number; currency: string; returnUrl?: string; paymentChannel?: PaymentChannelCode },
	): Promise<TopUpAiWalletResult> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/ai-wallet/top-up`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Idempotence-Key": idempotenceKey,
			},
			body: JSON.stringify({
				amount: payload.amount,
				currency: payload.currency,
				returnUrl: payload.returnUrl,
				paymentChannel: payload.paymentChannel,
			}),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to top up ai wallet: ${res.status}`);
		}

		return res.json();
	}

	async searchLegalEntityRequisites(query: string, signal: AbortSignal): Promise<FoundBillingRequisites[]> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/legal-entities/search`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query,
				}),
				credentials: "include",
				signal,
			},
		);

		const requisites: FoundBillingRequisites[] = (await res.json()).result;

		return requisites;
	}

	async switchToLegalEntity(requisites: BillingRequisitesInput): Promise<void> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/legal-entity/switch`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requisites),
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to switch to legal entity: ${res.status}`);
		}
	}

	async cancelSubscription(paymentChannel?: PaymentChannelCode): Promise<void> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/subscription/cancel`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ paymentChannel }),
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to cancel subscription: ${res.status}`);
		}
	}

	async getChangePeriodPaymentInfo(): Promise<GesCloudChangePeriodPaymentInfo> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/subscription/change-period/info`,
			{ credentials: "include" },
		);

		if (!res.ok) {
			throw new Error(`Failed to get change period payment info: ${res.status}`);
		}

		return res.json();
	}

	async changeBillingPeriod(
		idempotenceKey: string,
		payload: { returnUrl?: string; paymentChannel?: PaymentChannelCode },
	): Promise<ChangeBillingPeriodResult> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/subscription/change-period`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Idempotence-Key": idempotenceKey,
				},
				body: JSON.stringify({ returnUrl: payload.returnUrl, paymentChannel: payload.paymentChannel }),
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to change billing period: ${res.status}`);
		}

		return res.json();
	}

	async getPaymentMethods(): Promise<GesCloudPaymentMethod[]> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/payment-methods`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get payment methods: ${res.status}`);
		}

		const data: { paymentMethods: GesCloudPaymentMethod[] } = await res.json();
		return data.paymentMethods;
	}

	async bindPaymentMethod(idempotenceKey: string, payload: { returnUrl: string }): Promise<BindPaymentMethodResult> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/payment-methods/binding/start`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Idempotence-Key": idempotenceKey,
				},
				body: JSON.stringify({ returnUrl: payload.returnUrl }),
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to bind payment method: ${res.status}`);
		}

		return res.json();
	}

	async setDefaultPaymentMethod(id: string): Promise<void> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/payment-methods/set-default`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id }),
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to set default payment method: ${res.status}`);
		}
	}

	async deletePaymentMethods(idList: string[]): Promise<void> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/payment-methods/delete`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idList }),
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to delete payment methods: ${res.status}`);
		}
	}

	async getPaymentMethodBindingStatus(): Promise<PaymentMethodBindingStatus> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/billing/payment-methods/binding/status`,
			{ credentials: "include" },
		);

		if (!res.ok) {
			throw new Error(`Failed to get payment method binding status: ${res.status}`);
		}

		const data: { status: PaymentMethodBindingStatus } = await res.json();
		return data.status;
	}

	async getRecoverPaymentInfo(): Promise<GesCloudRecoverPaymentInfo> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/recover/info`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get recover payment info: ${res.status}`);
		}

		return res.json();
	}

	async recoverFromSuspended(
		idempotenceKey: string,
		payload: { paymentChannel?: PaymentChannelCode } = {},
	): Promise<RecoverFromSuspendedResult> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/billing/recover`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Idempotence-Key": idempotenceKey },
			body: JSON.stringify({ paymentChannel: payload.paymentChannel }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to recover from suspended: ${res.status}`);
		}

		return res.json();
	}

	async createToken(payload: { name: string; expiresAt: string }): Promise<string> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/access-tokens/create`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to create token: ${res.status}`);
		}

		const data: { token: string } = await res.json();
		return data.token;
	}

	async getTokens(): Promise<AccessTokenItem[]> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/access-tokens/get`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get tokens: ${res.status}`);
		}

		const data: { tokens: AccessTokenItem[] } = await res.json();
		return data.tokens;
	}

	async revokeToken(id: number): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/access-tokens/revoke`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to revoke token: ${res.status}`);
		}
	}

	async excludeMembers(emails: string[]): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/members/exclude`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ emails }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to exclude members: ${res.status}`);
		}
	}

	async getUser(): Promise<GesCloudUserWithPermissions | null> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/sso/get-user`, {
			credentials: "include",
		});

		if (res.status === 401 || res.status === 404) return null;

		if (!res.ok) throw new Error(`Failed to get user: ${res.status}`);

		const data = (await res.json()) as {
			info: UserInfo;
			workspacePermissions: string[];
			catalogsPermissions?: {
				resourceId: string;
				permissions: string[];
				props: { branches?: string[]; mainBranch: string; mainBranchProtected: boolean };
			}[];
		};

		const catalogsPermissions = data.catalogsPermissions;
		const newCatalogsPermissions: { [catalogName: string]: string[] } = {};
		const newCatalogsProps: {
			[catalogName: string]: { branches?: string[]; mainBranch: string; mainBranchProtected: boolean };
		} = {};
		catalogsPermissions.forEach(({ resourceId, permissions, props }) => {
			const split = resourceId.split("/");
			const catalogName = split.pop();
			if (!catalogName) return;
			newCatalogsPermissions[catalogName] = permissions;
			newCatalogsProps[catalogName] = props;
		});
		return { ...data, catalogsPermissions: newCatalogsPermissions, catalogsProps: newCatalogsProps };
	}

	async getUserSettings(): Promise<UserSettings | undefined> {
		if (!this._gesCloudUrl) return;

		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/sso/get-user-settings`, {
			credentials: "include",
		});
		if (!res.ok || res.status !== 200) return;

		return await res.json();
	}

	async getUserOrganizations(): Promise<OrganizationInfo[]> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/user/organizations`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get user organizations: ${res.status}`);
		}

		const data: GetUserOrganizationsResponse = await res.json();
		return data.organizations;
	}

	async getOrganization(): Promise<Organization> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/get`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to get organization: ${res.status}`);
		}

		const data: GetOrganizationResponse = await res.json();
		return data.organization;
	}

	async updateOrganization(name: string): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/edit`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ organization: { name } }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to update organization: ${res.status}`);
		}
	}

	async setUserAdmin(payload: { email: string; setAdmin: boolean }): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/members/set-admin`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to set admin role for user: ${res.status}`);
		}
	}

	async initStorage(resourceId: string) {
		try {
			const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/config/init-repo`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resourceId }),
				credentials: "include",
			});
			if (res.status === 403) throw new DefaultError(t("enterprise.init-repo.forbidden"));
			if (res.status === 409) throw new DefaultError(t("enterprise.init-repo.already-exists"));

			return res.ok;
		} catch (e) {
			if (e instanceof DefaultError) throw e;
			throw new DefaultError(t("enterprise.init-repo.error"), e, { showCause: true });
		}
	}

	async getRepositoryData(): Promise<Partial<Settings>> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/repositories/get`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to retrieve repository data	: ${res.status}`);
		}

		const data: Partial<Settings> = await res.json();
		return data;
	}

	async getGitResources(): Promise<string[]> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/repositories/available`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to retrieve git resources: ${res.status}`);
		}

		const data = await res.json();
		return data.allGitResources;
	}

	async saveGitResource(resource: ResourcesSettings): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/repositories/save`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resource }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to retrieve git resources: ${res.status}`);
		}
	}

	async deleteGitResources(resourceIds: string[]): Promise<void> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/organization/repositories/delete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ resourceIds }),
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to delete git resources: ${res.status}`);
		}
	}

	async searchGitBranches(resourceId: string): Promise<string[]> {
		const res = await this._fetch(
			`${this._gesCloudUrl}/enterprise-cloud/organization/repositories/branches?resourceId=${encodeURIComponent(resourceId)}`,
			{
				credentials: "include",
			},
		);

		if (!res.ok) {
			throw new Error(`Failed to retrieve resource branches: ${res.status}`);
		}

		const data = await res.json();
		return data.branches;
	}

	async setInitDesktopData(oneTimeCode: string): Promise<string> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/sso/token?oneTimeCode=${oneTimeCode}`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to set token: ${res.status}`);
		}

		const data = await res.json();
		return data.url;
	}

	async desktopLogout(): Promise<string> {
		const res = await this._fetch(`${this._gesCloudUrl}/enterprise-cloud/desktop/sso/logout`, {
			credentials: "include",
		});

		if (!res.ok) {
			throw new Error(`Failed to logout: ${res.status}`);
		}

		const data = await res.json();
		return data.url;
	}

	getLogoutUrl(): string {
		return `${this._gesCloudUrl}/enterprise-cloud/sso/logout`;
	}

	private async _fetch(url: string, options?: RequestInit): Promise<Response> {
		if (this._fetchMode === "desktop") return resolveModule("httpFetch")(url, options);
		return fetch(url, options);
	}

	private _getInvoiceFileName(contentDisposition: string | null, invoiceId: string): string {
		const fileName = contentDisposition?.match(/filename="([^"]+)"/)?.[1];
		return fileName ?? `invoice-${invoiceId}.pdf`;
	}
}
