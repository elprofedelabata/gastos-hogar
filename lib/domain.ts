export type MoneyShares = Record<string, number>;

export type ExpenseDraft = {
  totalCents: number;
  payments: MoneyShares;
  allocations: MoneyShares;
};

export type ExpenseValidation = {
  valid: boolean;
  paymentDifference: number;
  allocationDifference: number;
};

export function eurosToCents(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function splitEvenly(totalCents: number, profileIds: string[]): MoneyShares {
  if (profileIds.length === 0) return {};

  const base = Math.floor(totalCents / profileIds.length);
  let remainder = totalCents - base * profileIds.length;

  return Object.fromEntries(
    profileIds.map((profileId) => {
      const extraCent = remainder > 0 ? 1 : 0;
      remainder -= extraCent;
      return [profileId, base + extraCent];
    }),
  );
}

export function sumShares(shares: MoneyShares): number {
  return Object.values(shares).reduce((sum, value) => sum + value, 0);
}

export function validateExpense(draft: ExpenseDraft): ExpenseValidation {
  const paymentDifference = draft.totalCents - sumShares(draft.payments);
  const allocationDifference = draft.totalCents - sumShares(draft.allocations);

  return {
    valid:
      draft.totalCents > 0 &&
      paymentDifference === 0 &&
      allocationDifference === 0,
    paymentDifference,
    allocationDifference,
  };
}

export function balanceDeltaFor(
  profileId: string,
  payments: MoneyShares,
  allocations: MoneyShares,
): number {
  return (payments[profileId] ?? 0) - (allocations[profileId] ?? 0);
}
