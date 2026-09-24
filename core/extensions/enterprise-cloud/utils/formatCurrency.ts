const CURRENCY_LOCALE = "ru-RU";

export const formatCurrency = (amount: number | string, currency: string): string =>
	new Intl.NumberFormat(CURRENCY_LOCALE, {
		style: "currency",
		currency,
		currencyDisplay: "code",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Number(amount));
