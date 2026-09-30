import type { BalanceEntry, SettlementTransfer } from './types';

export function formatPesos(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  const formatted = pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (centavos < 0) return `−₱${formatted}`;
  return `₱${formatted}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function relativeTime(isoStr: string | null): string {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export function minsSince(isoStr: string | null): number {
  if (!isoStr) return 0;
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
}

export function minsUntil(isoStr: string | null): number {
  if (!isoStr) return 0;
  return Math.floor((new Date(isoStr).getTime() - Date.now()) / 60000);
}

/**
 * Compute net balances from a list of expenses and splits.
 * Positive = they are owed money. Negative = they owe money.
 */
export function computeBalances(
  expenses: Array<{
    amount_centavos: number;
    paid_by: string;
    splits: Array<{ user_id: string }>;
  }>,
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const exp of expenses) {
    const shareCount = exp.splits.length;
    if (shareCount === 0) continue;
    const share = Math.floor(exp.amount_centavos / shareCount);
    const remainder = exp.amount_centavos - share * shareCount;
    balances.set(exp.paid_by, (balances.get(exp.paid_by) ?? 0) + exp.amount_centavos);
    exp.splits.forEach((s, i) => {
      const extra = i < remainder ? 1 : 0;
      balances.set(s.user_id, (balances.get(s.user_id) ?? 0) - (share + extra));
    });
  }
  return balances;
}

/**
 * Subtract confirmed payments from balances.
 */
export function applyPayments(
  balances: Map<string, number>,
  payments: Array<{
    payer_id: string;
    receiver_id: string;
    amount_centavos: number;
    status: string;
  }>,
): Map<string, number> {
  const result = new Map(balances);
  for (const p of payments) {
    if (p.status !== 'confirmed') continue;
    result.set(p.payer_id, (result.get(p.payer_id) ?? 0) + p.amount_centavos);
    result.set(p.receiver_id, (result.get(p.receiver_id) ?? 0) - p.amount_centavos);
  }
  return result;
}

/**
 * Greedy algorithm to minimize the number of transfers needed to settle balances.
 * Sorts debtors (negative) and creditors (positive), then matches largest with largest.
 */
export function settleUp(balances: Map<string, number>): SettlementTransfer[] {
  const debtors: BalanceEntry[] = [];
  const creditors: BalanceEntry[] = [];

  for (const [user_id, net] of balances) {
    if (net < -0.5) {
      debtors.push({ user_id, net_centavos: Math.round(net) });
    } else if (net > 0.5) {
      creditors.push({ user_id, net_centavos: Math.round(net) });
    }
  }

  debtors.sort((a, b) => a.net_centavos - b.net_centavos);
  creditors.sort((a, b) => b.net_centavos - a.net_centavos);

  const transfers: SettlementTransfer[] = [];
  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debt = debtors[di];
    const credit = creditors[ci];
    const amount = Math.min(-debt.net_centavos, credit.net_centavos);

    if (amount > 0) {
      transfers.push({
        from: debt.user_id,
        to: credit.user_id,
        amount_centavos: amount,
      });
    }

    debt.net_centavos += amount;
    credit.net_centavos -= amount;

    if (Math.abs(debt.net_centavos) < 0.5) di++;
    if (Math.abs(credit.net_centavos) < 0.5) ci++;
  }

  return transfers;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
