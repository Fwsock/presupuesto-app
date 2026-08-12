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

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
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
