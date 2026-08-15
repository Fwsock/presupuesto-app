import { isPromotionalNotification } from './bankNotificationParser';
import type { NotificationMovementType } from './bankNotificationParser';

export interface ScannedDocument {
  monto: number | null;
  comercio: string | null;
  fecha: string | null;
  tipo: NotificationMovementType | null;
}

// ---------------------------------------------------------------------------
// Fuzzy matching -- ML Kit on a real photographed boleta (table shadows, an
// angled shot, a finger holding the paper) regularly confuses a handful of
// characters, and can drop/duplicate a letter outright. Exact substring
// matching alone rejects perfectly valid receipts over that noise, so every
// keyword list below is matched through fuzzyKeywordMatch instead of a bare
// .includes() -- see its own comment for exactly what it tolerates and why
// short keywords deliberately get less slack than long ones.
// ---------------------------------------------------------------------------

// Characters ML Kit most often confuses on low-quality/angled boleta
// photos -- applied only to a throwaway copy of a line used for KEYWORD
// matching, never to the copy used for parsing amounts (where '0' must stay
// '0'). '7'/'t' and '4'/'a' show up often on thermal-printer receipt fonts.
const OCR_CONFUSION_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '5': 's',
  '8': 'b',
  '$': 's',
  '2': 'z',
  '7': 't',
  '4': 'a',
};

function homogenizeOcrConfusions(text: string): string {
  return text.replace(/[01582$74]/g, (ch) => OCR_CONFUSION_MAP[ch] ?? ch);
}

/** Iterative (non-recursive, no risk of stack overflow on a long OCR line) Levenshtein edit distance. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j] + 1;
      const deleteCost = previousRow[j + 1] + 1;
      const substituteCost = previousRow[j] + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}

/**
 * How much edit-distance slack a keyword of this length gets, on top of
 * exact/homogenized matching. Deliberately 0 for short (<=4 char) keywords
 * like "iva"/"rut"/"vale"/"neto": those already collide with real short
 * Spanish words at distance 1 (e.g. "iba" vs "iva"), so they rely only on
 * the explicit character-confusion map above, never open-ended fuzzing.
 * Longer keywords have far fewer accidental neighbors, so they can safely
 * absorb a dropped/duplicated/misread letter.
 */
function maxEditDistanceFor(keywordLength: number): number {
  if (keywordLength <= 4) return 0;
  if (keywordLength <= 8) return 1;
  return 2;
}

// Escapes a keyword for safe embedding inside a RegExp -- none of our
// keywords currently contain regex metacharacters, but a phrase keyword is
// still user-authored text, not a pattern, so it must never be interpreted
// as one.
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word/whole-phrase match, anchored on \b -- "rut" must never match inside "ruta", "caja" must never match inside "cajon". */
function boundaryMatch(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`\\b${escapeForRegex(needle)}\\b`, 'u').test(haystack);
}

/**
 * True if `line` fuzzily contains `keyword`. Single-word keywords are
 * matched per-token: exact whole-word match first, then the same check
 * against a character-homogenized copy (catches "T0TAL"/"T07AL" -> "total"
 * at zero edit distance), then -- for keywords over 4 characters only -- a
 * bounded Levenshtein comparison against each word in the line, to catch a
 * dropped or extra letter the confusion map alone can't fix (e.g. "TOTA" or
 * "TOTALL"). Multi-word/hyphenated keywords ("a pagar", "sub-total",
 * "gracias por su compra") are matched as a whole-phrase boundary match
 * only -- OCR mostly preserves word boundaries and spacing, and running
 * Levenshtein across a whole phrase invites far more false positives than
 * it prevents.
 */
function fuzzyLineIncludes(line: string, keyword: string): boolean {
  const normalizedLine = normalize(line);
  const normalizedKeyword = normalize(keyword);
  if (boundaryMatch(normalizedLine, normalizedKeyword)) return true;

  const homogenizedLine = homogenizeOcrConfusions(normalizedLine);
  const homogenizedKeyword = homogenizeOcrConfusions(normalizedKeyword);
  if (boundaryMatch(homogenizedLine, homogenizedKeyword)) return true;

  if (/[\s-]/.test(normalizedKeyword)) return false;

  const threshold = maxEditDistanceFor(homogenizedKeyword.length);
  if (threshold === 0) return false;

  const words = homogenizedLine.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some((word) => {
    // Cheap short-circuit before paying for a full Levenshtein pass, and it
    // stops e.g. a lone "s" from fuzzily matching a 5-letter keyword purely
    // through length-blind edit-distance leniency.
    if (Math.abs(word.length - homogenizedKeyword.length) > threshold) return false;
    return levenshteinDistance(word, homogenizedKeyword) <= threshold;
  });
}

function fuzzyKeywordMatch(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => fuzzyLineIncludes(text, keyword));
}

// ---------------------------------------------------------------------------
// Keyword lists
// ---------------------------------------------------------------------------

// Lines fuzzily matching any of these never count as the grand total, even
// though "subtotal"/"neto" describe amounts that sit right next to it on a
// real boleta -- "neto" is the pre-IVA amount, never the final total.
// "total ahorrado" (how much a discount/loyalty program saved) is a real
// trap: it fuzzily matches the word "total" on its own, but is never the
// amount actually charged (a real Salcobrand boleta shows both). Loyalty-
// program lines ("TOTAL ACUMULADO $ 1.512" on a real Lider boleta) are the
// same trap for the same reason -- fuzzily matches "total" but is a points
// balance, not a peso amount, and it's easy for it to end up the LAST
// matching labeled line on a long receipt (the tie-break this function's
// caller uses), silently winning over the real total further down.
const EXCLUDED_AMOUNT_KEYWORDS = [
  'subtotal',
  'sub total',
  'sub-total',
  'neto',
  'iva',
  'vuelto',
  'propina',
  'efectivo',
  'total ahorrado',
  'descuento',
  'acumulado',
  'acumulacion',
  'puntos',
  'pesos mi club',
  'puntos cencosud',
  'mi club',
  'total acumulado',
  'ahorrado',
  'beneficios',
  'saldo',
];

// Broadened beyond a literal "TOTAL" line: boletas/facturas say "total" or
// "total a pagar", a transfer confirmation screen usually says "monto",
// "monto transferido/enviado" or "importe" instead, a small bazaar vale may
// just say "a pagar"/"pagar", and the payment-method line ("T. DEBITO",
// "TARJETA CREDITO") usually repeats the exact charged amount -- any of
// these is treated as a labeled-amount line.
const AMOUNT_LABEL_KEYWORDS = ['total', 'monto', 'importe', 'a pagar', 'pagar', 'valor', 'debito', 'credito'];

// Wide enough to cover boletas/facturas electrónicas (Chilean SII wording),
// small-comercio vales, AND bank transfer confirmations/screenshots --
// validation no longer requires a literal "boleta"/"factura" word, since a
// real transfer screenshot never contains those, and a real photographed
// boleta may only clearly OCR a payment-method or footer word instead of
// the store header.
const DOCUMENT_SIGNAL_KEYWORDS = [
  'boleta',
  'factura',
  'electronica',
  'documento tributario',
  'total',
  'neto',
  'iva',
  'rut',
  'folio',
  'comprobante',
  'recibo',
  'venta',
  'transaccion',
  'exenta',
  'afecta',
  'caja',
  'cajero',
  'vendedor',
  'gracias por su compra',
  'debito',
  'credito',
  'transferencia',
  'transferiste',
  'transferido',
  'enviaste',
  'enviado',
  'recibiste',
  'recibido',
  'deposito',
  'abono',
  'destinatario',
  'beneficiario',
  'cuenta destino',
  'monto',
  'vale',
];

// Beyond receipt boilerplate (boleta/factura/rut/...), also skips transfer
// boilerplate and labeled fields (fecha/monto/para/destinatario/...) -- those
// must fall through to extractDocumentDate/extractDocumentAmount/the
// RECIPIENT_LABEL_PATTERN fallback below instead of being grabbed whole
// (label included) as if they were a business/person name.
const HEADER_SKIP_KEYWORDS = [
  'boleta',
  'factura',
  'electronica',
  'documento tributario',
  'rut',
  'giro',
  'direccion',
  'fono',
  'sucursal',
  'comprobante',
  'transferencia',
  'fecha',
  'monto',
  'hora',
  'para',
  'destinatario',
  'beneficiario',
  'vale',
  'neto',
  'exenta',
  'afecta',
  'caja',
  'cajero',
  'vendedor',
  'debito',
  'credito',
  // Administrative rubber stamps ("CANCELADO"/"PAGADO" crossed diagonally
  // over the header, "CEDIBLE"/"DUPLICADO"/"COPIA" printed near the top or
  // bottom) are never the business name -- without this, a stamped boleta
  // (e.g. VITEL's "CANCELADO" stamp landing on the header) would return the
  // stamp text itself as "comercio" instead of the real store name.
  'cancelado',
  'cedible',
  'duplicado',
  'pagado',
  'copia',
  // Address/fiscal-data lines ("SUC: SANCHEZ FONTECILLA #8968", "AV. KENNEDY
  // 9001", "PASAJE LOS CACTUS", "SII SANTIAGO SUR") read like plausible
  // "first clean line" candidates otherwise -- they're never the business
  // name, they're where it is, or who taxes it.
  'suc',
  'av',
  'calle',
  'pasaje',
  'sii',
];

// A branch/lot number marker ("#8968", "N° 123") is a strong, independent
// signal that a header line is an address, even on a line HEADER_SKIP_KEYWORDS
// doesn't otherwise catch (e.g. "SANCHEZ FONTECILLA #8968" has no fiscal
// keyword on it at all once "SUC:" is trimmed away by upstream OCR).
const ADDRESS_NUMBER_PATTERN = /#\d|n[°º]\s*\d/i;

// ---------------------------------------------------------------------------
// Known Chilean chain aliases -- searched across the ENTIRE OCR text (not
// just the header window below), since the actual brand name/URL/loyalty-
// program mention is often buried mid-receipt or in the footer rather than
// the header, which is usually just the legal entity/branch/address instead
// (see extractDocumentComercio's own comment for why this runs first).
// ---------------------------------------------------------------------------
interface MerchantAlias {
  name: string;
  keywords: string[];
}

const MERCHANT_ALIASES: MerchantAlias[] = [
  { name: 'Lider', keywords: ['lider', 'lider.cl', 'mi club', 'precios bajos todos los dias'] },
  { name: 'Jumbo', keywords: ['jumbo', 'jumbo.cl', 'cencosud', 'puntos cencosud'] },
  { name: 'Santa Isabel', keywords: ['santa isabel', 'santaisabel.cl'] },
  { name: 'Unimarc', keywords: ['unimarc', 'club unimarc'] },
  { name: 'Salcobrand', keywords: ['salcobrand', 'sb.cl'] },
  { name: 'Cruz Verde', keywords: ['cruz verde', 'cruzverde.cl'] },
  { name: 'Farmacias Ahumada', keywords: ['farmacias ahumada', 'ahumada'] },
  { name: 'Falabella', keywords: ['falabella', 'falabella.com', 'cmr'] },
  { name: 'Paris', keywords: ['paris', 'paris.cl'] },
];

/** First known chain whose alias/keyword appears anywhere in `text`, or null -- dictionary order is the tie-break when a receipt mentions more than one (rare). */
function matchKnownMerchant(text: string): string | null {
  for (const alias of MERCHANT_ALIASES) {
    if (fuzzyKeywordMatch(text, alias.keywords)) return alias.name;
  }
  return null;
}

const INGRESO_KEYWORDS = ['recibiste', 'recibida', 'recibido', 'deposito', 'abono', 'abonado', 'te transfirieron'];
const GASTO_KEYWORDS = ['compra', 'compraste', 'cargo', 'pagaste', 'pago', 'enviaste', 'transferiste', 'giro', 'retiro'];

// ---------------------------------------------------------------------------
// Structural patterns (amounts, dates, names) -- these stay exact-regex, not
// fuzzy: an amount's actual digits/date's actual numbers must never be
// "corrected" by a homogenization pass built for matching keywords.
// ---------------------------------------------------------------------------

// A line that's only digits/punctuation (a RUT, a date, a folio number) is
// never a business/person name, even if it's the very first line.
const RUT_OR_NUMERIC_LINE = /^[\d.\-\/kK\s]+$/;

const ITEM_LINE_PATTERN = /^(.{3,40}?)\s+\$?\s*(\d{1,3}(?:\.\d{3})*)\s*$/;

// Global so firstMatch (via matchAll) can read it -- .matchAll() throws on a
// non-global regex.
const AMOUNT_PATTERN = /\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\b/g;
// Anywhere-in-text fallbacks (same shapes bankNotificationParser looks for
// in push-notification text), used only when no labeled line has an amount
// -- global so collectFallbackAmounts (see extractDocumentAmount) can weigh
// every candidate on the page instead of just the first one found.
const AMOUNT_WITH_SIGN = /\$\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/g;
const AMOUNT_WITH_CLP = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*CLP\b/gi;
// No currency-symbol requirement at all -- this is what actually absorbs a
// misread "$" -> "S" (a named OCR confusion): "S7.280" still has its
// "7.280" picked up here regardless of what came before it.
const AMOUNT_GROUPED = /\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?)\b/g;

// An explicit "Para:"/"Destinatario:"/"Beneficiario:" labeled field (colon
// required) -- checked BEFORE the header-line heuristic, not just as its
// fallback: on a bank-app transfer screenshot, the top of the screen is
// usually the bank's own branding ("Banco Estado", "BancoEstado app"), which
// the header heuristic would otherwise happily accept as if it were the
// business/person name. A colon-labeled field is an unambiguous, much
// stronger signal of who the actual transaction party is.
const LABELED_RECIPIENT_PATTERN = /\b(?:para|destinatario|beneficiario)\s*:\s+([A-ZÁÉÍÓÚÑ][^\n]{1,40})/i;

// Looser fallback for when there's no colon-labeled field at all -- "para/a/
// de NAME" also covers "Transferiste $X a Juan Pérez" running-text style and
// a bare "Para María Gómez" without a colon. Only tried AFTER the header
// loop below fails to find anything, never before: unlike the colon-labeled
// pattern above, a bare "de NAME" can also occur inside an ordinary item
// description ("QUESO DE Holanda"), so it must never outrank a real header.
const RECIPIENT_LABEL_PATTERN = /\b(?:para|destinatario|beneficiario|de)\s*:?\s+([A-ZÁÉÍÓÚÑ][^\n]{1,40})/i;

// DD/MM/YYYY, DD-MM-YYYY or DD.MM.YYYY (2 or 4 digit year), tolerant of
// stray whitespace around the separators (a common OCR spacing artifact) --
// the near-universal date format on Chilean boletas/comprobantes.
const DATE_PATTERN_DMY = /\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2}|\d{4})\b/;
// ISO order (YYYY-MM-DD), seen on some POS/bank export footers.
const DATE_PATTERN_YMD = /\b(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})\b/;
// HH:MM or HH:MM:SS -- a bare "18" or "42" out of a time stamp must never
// read as a peso amount.
const TIME_PATTERN = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;
// A Chilean RUT's own digits (e.g. "76.031.071-9"), independent of whether
// the word "RUT" appears nearby -- its dot-grouped digits are exactly
// amount-shaped and must never be mistaken for one.
const RUT_TOKEN_PATTERN = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/;
// Strips "47%"/"5 %"/"-12%" tokens before amount matching runs -- a discount
// percentage is never the amount itself, and left in place its bare digits
// ("47", "5") can slip past a permissive amount pattern.
function stripPercentages(text: string): string {
  return text.replace(/-?\d+(?:[.,]\d+)?\s?%/g, ' ');
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Strips OCR noise before validation/extraction runs: clutter around the
 * document itself (a table edge, a finger holding the paper, a fold/shadow
 * on the receipt) sometimes gets read as short garbage lines with no real
 * letters or digits in them -- those add nothing and can only get in the
 * way of a real signal keyword nearby. A line survives if it has at least 2
 * letters or digits; callers still keep the ORIGINAL text for display (e.g.
 * "Notificación original"), only the cleaned copy feeds the parser.
 */
export function cleanScannedText(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      const letterOrDigitCount = (trimmed.match(/[\p{L}\d]/gu) ?? []).length;
      return letterOrDigitCount >= 2;
    })
    .join('\n');
}

/**
 * Chilean-format-aware sanitizer: '.' is always a thousands separator here
 * (never decimal). A ',' followed by exactly 3 digits (and nothing else
 * right after) is ALSO read as a thousands separator -- e.g. "12,990" from
 * a US-formatted POS export or an OCR misread period -- since CLP has no
 * meaningful cents and a literal "$0,990" total is never realistic. Any
 * comma left after that is a genuine decimal separator (e.g. "12.990,50").
 * parseFloat can still return NaN for a malformed match; callers must never
 * trust this without checking Number.isFinite.
 */
function parseAmount(raw: string): number {
  const cleaned = raw
    .trim()
    .replace(/,(\d{3})(?!\d)/g, '$1')
    .replace(/\./g, '')
    .replace(',', '.');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/**
 * A line that can never contribute a real amount candidate: an excluded
 * label (subtotal/neto/iva/total ahorrado/etc), a RUT's own digits, or a
 * date/time stamp. The RUT/date/time checks matter specifically because
 * OCR frequently disconnects a "TOTAL"/"MONTO" label from its real number
 * (see extractDocumentAmount's own comment), which otherwise lets the
 * candidate search wander into a nearby RUT or date line and misread a
 * fragment of it as the amount -- e.g. "05/06/26" silently becoming "5".
 */
function isExcludedAmountLine(line: string): boolean {
  if (fuzzyKeywordMatch(line, EXCLUDED_AMOUNT_KEYWORDS)) return true;
  if (RUT_TOKEN_PATTERN.test(line) || fuzzyLineIncludes(line, 'rut')) return true;
  if (DATE_PATTERN_DMY.test(line) || DATE_PATTERN_YMD.test(line) || TIME_PATTERN.test(line)) return true;
  return false;
}

/** First regex match (with capture groups intact) regardless of whether `pattern` carries the global flag -- .match() silently drops capture groups on a global regex, so this is the only safe way to grab group 1 from our shared global amount patterns. */
function firstMatch(text: string, pattern: RegExp): RegExpMatchArray | null {
  const result = text.matchAll(pattern).next();
  return result.done ? null : result.value;
}

/**
 * Loose "does this even look like a financial document" guard, against
 * scanning a random object, a person, or a blank wall -- deliberately wider
 * than a receipt-only check (see DOCUMENT_SIGNAL_KEYWORDS) so a transfer
 * screenshot or an informal vale isn't rejected just for not saying "boleta",
 * and fuzzy enough that a boleta whose header/RUT/TOTAL got partially
 * garbled by OCR still passes on a payment-method or footer word instead.
 */
export function looksLikeScannedDocument(text: string): boolean {
  const normalized = normalize(text);
  if (normalized.trim().length < 8) return false;
  if (isPromotionalNotification(text)) return false;
  if (fuzzyKeywordMatch(text, DOCUMENT_SIGNAL_KEYWORDS)) return true;
  // No recognizable label at all -- last chance is a confidently extractable
  // amount (e.g. a plain "$12.990" with no other context still OCR'd fine).
  return extractDocumentAmount(text) !== null;
}

// A receipt total under this is implausible for every real sample seen so
// far (the cheapest single item across every fixture in this file is still
// several hundred pesos) -- below it, a "match" is far more likely a
// misread date/quantity/percentage fragment (see the "05/06/26" -> "5" bug
// this constant exists to close) than a genuine amount.
const MIN_PLAUSIBLE_AMOUNT = 100;

/** Every $X / X CLP / thousands-grouped amount found on a non-excluded line, at or above `minAmount`. */
function collectFallbackAmounts(text: string, minAmount: number): number[] {
  const amounts: number[] = [];
  for (const line of text.split('\n')) {
    if (isExcludedAmountLine(line)) continue;
    const stripped = stripPercentages(line);
    for (const pattern of [AMOUNT_WITH_SIGN, AMOUNT_WITH_CLP, AMOUNT_GROUPED]) {
      for (const match of stripped.matchAll(pattern)) {
        const amount = parseAmount(match[1]);
        if (amount >= minAmount) amounts.push(amount);
      }
    }
  }
  return amounts;
}

/** The one clear amount on a line, if any -- requires a "$" sign or thousands-grouping (never a bare 1-3 digit number on its own), and at least MIN_PLAUSIBLE_AMOUNT, so a quantity/point-counter/percentage remnant can never register as a candidate. */
function extractSingleAmountFromLine(line: string): number | null {
  if (isExcludedAmountLine(line)) return null;
  const stripped = stripPercentages(line);

  const withSign = firstMatch(stripped, AMOUNT_WITH_SIGN);
  if (withSign) {
    const amount = parseAmount(withSign[1]);
    if (amount >= MIN_PLAUSIBLE_AMOUNT) return amount;
  }
  const grouped = firstMatch(stripped, AMOUNT_GROUPED);
  if (grouped) {
    const amount = parseAmount(grouped[1]);
    if (amount >= MIN_PLAUSIBLE_AMOUNT) return amount;
  }
  return null;
}

/**
 * Tier 2 of extractDocumentAmount: when OCR has fully disconnected every
 * label from its number -- common on a real photographed boleta, where
 * ML Kit's line detection can group ALL the labels ("TOTAL", "T. DEBITO",
 * "VUELTO"...) into one cluster and ALL the numbers into a separate cluster
 * far below them -- proximity-based matching (Tier 1) never finds anything.
 * The total is still reliably identifiable another way: a Chilean POS
 * receipt (and especially its attached card-payment slip) almost always
 * restates the exact same final figure back-to-back on two consecutive
 * lines ("MONTO $19.075" then "TOTAL $19.075", both landing as bare
 * "19.075" / "19.075" lines once OCR strips the labels) -- while every
 * OTHER number on the page (an item price, a NETO/IVA breakdown component,
 * a discount) appears only once. Returns the first such adjacent repeat.
 */
function findConsecutiveDuplicateAmount(text: string): number | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let previous: number | null = null;
  for (const line of lines) {
    const amount = extractSingleAmountFromLine(line);
    if (amount !== null && amount === previous) return amount;
    previous = amount;
  }
  return null;
}

/**
 * Layered, cautious amount extraction:
 *   1. A fuzzily-labeled line ("total", "monto", "importe", "a pagar",
 *      "debito"/"credito" -- never a fuzzily-excluded "subtotal"/"neto"/
 *      "iva"/"total ahorrado"/etc line, see EXCLUDED_AMOUNT_KEYWORDS),
 *      checking that same line and, at most, the ONE immediately following
 *      line (never further: a real boleta often stacks several labels back
 *      to back with no number between them at all -- "TOTAL $" / "I. DEBITO
 *      $" / "VUELTO $" -- and reaching 2+ lines ahead from one of those
 *      risks grabbing a number that actually belongs to a completely
 *      different label in that same cluster, not this one). A lookahead
 *      match (not on the label's own line) is only trusted when it's
 *      unambiguously amount-shaped ("$" or a thousands-separator present) --
 *      a bare, unformatted number is too easy to confuse with a nearby
 *      folio/document number. Percentages are stripped before matching, and
 *      a match under MIN_PLAUSIBLE_AMOUNT is rejected outright (this is
 *      what stops a misread date fragment from ever being accepted as the
 *      total). When more than one labeled line qualifies, the LAST one wins
 *      (boletas list subtotal/IVA before the final total).
 *   2. No labeled+number pairing found at all -- this is the common case
 *      once ML Kit's line detection has grouped every label into one
 *      cluster and every number into a separate cluster further down the
 *      page. Try findConsecutiveDuplicateAmount (see its own comment): the
 *      figure repeated back-to-back on two adjacent lines.
 *   3. Still nothing -- fall back to the LARGEST amount found anywhere in
 *      the text (excluding subtotal/neto/iva/RUT/date/etc lines), first
 *      requiring MIN_PLAUSIBLE_AMOUNT and only dropping that floor if truly
 *      nothing clears it, so a scan is never rejected outright as long as
 *      SOME number was legible.
 */
export function extractDocumentAmount(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim());
  let found: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || isExcludedAmountLine(line)) continue;
    if (!fuzzyKeywordMatch(line, AMOUNT_LABEL_KEYWORDS)) continue;

    for (const candidate of [line, lines[i + 1]]) {
      if (!candidate || isExcludedAmountLine(candidate)) continue;
      const stripped = stripPercentages(candidate);
      const match = firstMatch(stripped, AMOUNT_PATTERN);
      if (!match) continue;
      const amount = parseAmount(match[1]);
      if (amount < MIN_PLAUSIBLE_AMOUNT) continue;
      const isSameLine = candidate === line;
      if (!isSameLine && !/[$.,]/.test(match[0])) continue;
      found = amount;
      break;
    }
  }

  if (found !== null) return found;

  const duplicate = findConsecutiveDuplicateAmount(text);
  if (duplicate !== null) return duplicate;

  const plausible = collectFallbackAmounts(text, MIN_PLAUSIBLE_AMOUNT);
  if (plausible.length > 0) return Math.max(...plausible);

  // Absolute last resort: the image had SOME legible number, just none of
  // it looked like a normal-sized peso amount -- still better than nothing.
  const anyAmount = collectFallbackAmounts(text, 1);
  return anyAmount.length > 0 ? Math.max(...anyAmount) : null;
}

/**
 * Priority order:
 *   1. A colon-labeled "Destinatario:"/"Para:"/"Beneficiario:" field (see
 *      LABELED_RECIPIENT_PATTERN's own comment for why it wins outright).
 *   2. A known Chilean chain (see MERCHANT_ALIASES), searched across the
 *      WHOLE text -- on a real boleta the header is usually just the legal
 *      entity/branch/address ("SUC: SANCHEZ FONTECILLA #8968", "SII SANTIAGO
 *      SUR"), while the actual brand name/URL/loyalty program mention
 *      ("revisa tu boleta en WWW.LIDER.CL", "PUNTOS CENCOSUD") is often
 *      buried mid-receipt or in the footer -- a header-only search would
 *      never reach it.
 *   3. The first header-area line that reads like a business/person name,
 *      rather than a RUT, date, address or boilerplate label.
 *   4. A looser "para/de NAME" match anywhere in the text, for transfer-
 *      style running text where the name never sits in the header.
 * Null when nothing is confident enough -- callers fall back to "Comercio
 * no detectado".
 */
export function extractDocumentComercio(text: string): string | null {
  const labeledMatch = text.match(LABELED_RECIPIENT_PATTERN);
  if (labeledMatch) return labeledMatch[1].trim();

  const knownMerchant = matchKnownMerchant(text);
  if (knownMerchant) return knownMerchant;

  const headerLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);

  for (const line of headerLines) {
    if (line.length < 3) continue;
    if (RUT_OR_NUMERIC_LINE.test(line)) continue;
    // A transaction-description line ("Recibiste $30.000") or one starting
    // with a bare preposition ("de Maria Gomez") is never a business/person
    // name by itself -- the latter falls through to RECIPIENT_LABEL_PATTERN
    // below, which strips the leading "de"/"para" instead of including it.
    if (line.includes('$')) continue;
    if (/^(de|a|para)\s+/i.test(line)) continue;
    if (ADDRESS_NUMBER_PATTERN.test(line)) continue;
    if (fuzzyKeywordMatch(line, HEADER_SKIP_KEYWORDS)) continue;
    return line;
  }

  const recipientMatch = text.match(RECIPIENT_LABEL_PATTERN);
  return recipientMatch ? recipientMatch[1].trim() : null;
}

function toIsoDateIfReal(year: number, month: number, day: number): string | null {
  // Round-trip through Date.UTC and compare components back -- JS otherwise
  // silently rolls overflowing days over (e.g. 31/02 becomes 03/03).
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  if (!isReal) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' if a real calendar date is found (DD/MM/YYYY, DD-MM-YYYY or ISO YYYY-MM-DD, 2 or 4 digit year), else null -- callers fall back to today's date. */
export function extractDocumentDate(text: string): string | null {
  const dmy = text.match(DATE_PATTERN_DMY);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    const iso = toIsoDateIfReal(year, Number(dmy[2]), Number(dmy[1]));
    if (iso) return iso;
  }

  const ymd = text.match(DATE_PATTERN_YMD);
  if (ymd) {
    const iso = toIsoDateIfReal(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    if (iso) return iso;
  }

  return null;
}

export function extractDocumentType(text: string): NotificationMovementType | null {
  if (fuzzyKeywordMatch(text, INGRESO_KEYWORDS)) return 'ingreso';
  if (fuzzyKeywordMatch(text, GASTO_KEYWORDS)) return 'gasto';
  return null;
}

/** Best-effort "PRODUCTO ... $1.990"-shaped lines, skipping labeled-amount/excluded lines -- only included when the OCR read them clearly, capped so a long boleta doesn't dump dozens of lines into the pending notification. */
export function extractDocumentItems(text: string): string[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const items: string[] = [];
  for (const line of lines) {
    if (isExcludedAmountLine(line) || fuzzyKeywordMatch(line, AMOUNT_LABEL_KEYWORDS)) continue;
    if (ITEM_LINE_PATTERN.test(line)) {
      items.push(line);
      if (items.length >= 6) break;
    }
  }
  return items;
}

export function parseScannedDocument(text: string): ScannedDocument {
  return {
    monto: extractDocumentAmount(text),
    comercio: extractDocumentComercio(text),
    fecha: extractDocumentDate(text),
    tipo: extractDocumentType(text),
  };
}
