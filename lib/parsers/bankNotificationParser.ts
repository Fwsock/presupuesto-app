export type NotificationMovementType = 'gasto' | 'ingreso';

export interface ParsedBankNotification {
  monto: number | null;
  comercio: string | null;
  tipo: NotificationMovementType | null;
}

const AMOUNT_WITH_SIGN = /\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/;
const AMOUNT_WITH_CLP = /(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*CLP\b/i;
const AMOUNT_GROUPED = /\b(\d{1,3}(?:\.\d{3})+(?:,\d+)?)\b/;

// "en/de/a X" where X starts with a capital letter — the capital requirement
// is what tells a merchant ("STARBUCKS", "JUAN PEREZ") apart from ordinary
// lowercase words ("en efectivo", "de vuelta") without a merchant keyword list.
const MERCHANT_PATTERN = /\b(?:en|de|a)\b\s+([A-ZÁÉÍÓÚÑ][^\n]*?)(?=\s+(?:el|por|tarjeta|con)\b|,|\.(?:\s|$)|$)/g;

const INGRESO_KEYWORDS = [
  'recibiste',
  'recibida',
  'recibido',
  'depósito',
  'deposito',
  'abono',
  'abonado',
  'te transfirieron',
  'pago recibido',
];

const GASTO_KEYWORDS = [
  'compra',
  'compraste',
  'cargo',
  'pagaste',
  'pagó',
  'enviaste',
  'giro',
  'retiro',
];

// Bank/fintech marketing copy ("¿Necesitas efectivo?", "Pide tu crédito
// preaprobado", referral spam like Tenpo's "invita a tus amigos y gana
// $3.000 Tenpesos") often reads a lot like a real transaction notification
// -- these keywords catch it before it ever reaches the pending inbox, see
// isRealTransactionNotification. Reproduced from a real false positive: a
// Tenpo referral notification ("...invita a tus amigos a Tenpo y gana
// $3.000 Tenpesos por cada uno que haga su primera compra...") contains
// "compra" (a real GASTO_KEYWORD) and a dollar amount, so without an
// explicit blacklist entry it was extracted as a genuine $3.000 gasto.
const PROMOTIONAL_KEYWORDS = [
  'necesitas efectivo',
  'pide tu credito',
  'solicita tu credito',
  'preaprobado',
  'pre aprobado',
  'oferta especial',
  'descuento',
  'promocion',
  'cupon',
  'codigo',
  'sorteo',
  'aumenta tu linea',
  'super tasa',
  'tasa preferencial',
  'postula',
  'cotiza',
  'activa tu tarjeta',
  'conoce mas',
  'enterate',
  'te invitamos',
  'aprovecha',
  'nueva tarjeta',
  'sube tu cupo',
  // Referral/reward spam (Tenpo, BancoEstado, Santander and similar apps
  // routinely push these as push notifications, not just in-app banners).
  'invita',
  'refiere',
  'referido',
  'gana',
  'ganaste',
  'tenpesos',
  'cashback',
  'premio',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Built once from PROMOTIONAL_KEYWORDS (already the single source of truth
// for the blacklist) instead of hand-writing a giant alternation -- same
// matching semantics as the old `.some(keyword => text.includes(...))` loop
// (plain substring, case/accent-insensitive via `normalize` on both sides),
// just expressed as one compiled regular expression.
const PROMOTIONAL_PATTERN = new RegExp(PROMOTIONAL_KEYWORDS.map((k) => escapeRegExp(normalize(k))).join('|'), 'i');

/** parseFloat can return NaN for malformed input -- callers must never trust this without checking Number.isFinite. */
function parseAmount(raw: string): number {
  const value = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

function extractAmount(text: string): number | null {
  const withSign = text.match(AMOUNT_WITH_SIGN);
  if (withSign) return parseAmount(withSign[1]);

  const withClp = text.match(AMOUNT_WITH_CLP);
  if (withClp) return parseAmount(withClp[1]);

  const grouped = text.match(AMOUNT_GROUPED);
  if (grouped) return parseAmount(grouped[1]);

  return null;
}

function extractMerchant(text: string): string | null {
  const matches = Array.from(text.matchAll(MERCHANT_PATTERN));
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1].trim();
}

function extractType(text: string): NotificationMovementType | null {
  const normalized = normalize(text);
  if (INGRESO_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))) {
    return 'ingreso';
  }
  if (GASTO_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)))) {
    return 'gasto';
  }
  return null;
}

export function parseBankNotification(text: string): ParsedBankNotification {
  return {
    monto: extractAmount(text),
    comercio: extractMerchant(text),
    tipo: extractType(text),
  };
}

export function isPromotionalNotification(text: string): boolean {
  return PROMOTIONAL_PATTERN.test(normalize(text));
}

/**
 * Security filter applied before a captured/pasted/OCR'd notification is
 * ever added to the pending inbox: only messages that both (a) have an
 * extractable amount and (b) don't read as bank marketing copy count as a
 * real transaction. Used identically by the background listener, the
 * persisted-queue drain, manual paste, and OCR -- they all funnel through
 * useAddPendingNotificationFromText, so checking it there covers every path.
 */
export function isRealTransactionNotification(text: string): boolean {
  if (isPromotionalNotification(text)) return false;
  return extractAmount(text) !== null;
}
