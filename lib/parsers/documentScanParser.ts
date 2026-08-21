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

// Exported (not just used internally): lib/brands/brandCatalog.ts reuses this
// exact same OCR-noise-tolerant matching for brand/logo detection on the
// comercio field, instead of re-implementing its own Levenshtein/confusion-
// map logic -- same tolerance for "unimarc"/"uninarc"-style typos, same
// short-keyword safety net.
export function fuzzyKeywordMatch(text: string, keywords: string[]): boolean {
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
  // A real Unimarc boleta's own footer prints "TOTAL AHORRO ULTIMOS 12
  // MESES: $30.752" -- a loyalty-savings figure that has NOTHING to do with
  // this purchase (the actual charged total on that same receipt was
  // $7.470, restated 4 times as "TOTAL $7470"/"TARJETA $7470"/"MONTO
  // $7.470"/"TOTAL $7.470"). "ahorrado" (past participle) above does NOT
  // fuzzy-match "ahorro" (noun) -- they differ by more than the edit-
  // distance slack a 6-8 char keyword gets, so this needs its own entry,
  // not just a stronger STRONG_TOTAL_LABEL_KEYWORDS tier: that block's own
  // "TOTAL AHORRO..." line fuzzily matches bare "total" as well as any real
  // total line does, and it can legitimately be the LAST such match on the
  // page. 'club unimarc'/'puntos unimarc' are the same loyalty-program
  // wrapper by name, for the per-item discount lines ("Club Unimarc CCU
  // -$700") and any bare mention of the program.
  'ahorro',
  'club unimarc',
  'puntos unimarc',
];

// Broadened beyond a literal "TOTAL" line: boletas/facturas say "total" or
// "total a pagar", a transfer confirmation screen usually says "monto",
// "monto transferido/enviado" or "importe" instead, a small bazaar vale may
// just say "a pagar"/"pagar", and the payment-method line ("T. DEBITO",
// "TARJETA CREDITO") usually repeats the exact charged amount -- any of
// these is treated as a labeled-amount line. Deliberately does NOT include
// "valor": every itemized boleta has a "Codigo  Cant.  Unitario  Valor"
// column header sitting right above the item prices, and that header line
// fuzzily matches "valor" just as well as a real payment label would --
// see STRONG_TOTAL_LABEL_KEYWORDS below for the line that actually fixes
// this (a real Strip La Florida Spa boleta: item price $4.300, but "valor"
// as a label used to let that outrank the real "TOTAL $3.870" after a
// "Descuento Global").
// "tarjeta" alone (not just "debito"/"credito") catches a bare "TARJETA
// $7.470" payment-amount line on receipts that don't spell out debit/credit
// right there (kept in the WIDE tier, not STRONG, below -- "NUMERO DE
// TARJETA: MC3581" is common boilerplate on a card-payment slip and is
// close enough in shape to a real "TARJETA $X" line that it shouldn't
// outrank an explicit TOTAL line the way STRONG keywords are allowed to).
const AMOUNT_LABEL_KEYWORDS = ['total', 'monto', 'importe', 'a pagar', 'pagar', 'debito', 'credito', 'tarjeta'];

// Tried BEFORE the wider AMOUNT_LABEL_KEYWORDS pass, never after: an
// explicit "TOTAL"/"TOTAL A PAGAR"/"TOTAL PAGADO"/"MONTO TOTAL"/"VALOR
// TOTAL"/"TOTAL CLP"/"TOTAL NETO" line is the strongest possible signal of
// the final charged amount, and must outrank a same-or-later
// "monto"/"importe"/"a pagar"/"debito"/"credito"/"tarjeta" line regardless
// of document order -- those can legitimately repeat the same figure, but
// they can also belong to an unrelated field further down a long/garbled
// OCR page. Multi-word entries here are safe as their own whole-phrase
// keywords (unlike bare "valor", which is a column header, not a total
// label -- see AMOUNT_LABEL_KEYWORDS above): a multi-word keyword only ever
// matches as a whole-phrase boundary match, so e.g. a lone "Valor" column
// header can never satisfy "valor total", and a lone "Neto $6277" line
// (already excluded outright via EXCLUDED_AMOUNT_KEYWORDS regardless) can
// never satisfy "total neto" either. Only falls through to the wider pass
// when no line on the page reads as an explicit total at all (e.g. a
// transfer screenshot that only ever says "monto").
const STRONG_TOTAL_LABEL_KEYWORDS = [
  'total a pagar',
  'total pagar',
  'total pagado',
  'monto total',
  'valor total',
  'total clp',
  'total neto',
  'total',
];

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
  // "CASA MATRIZ: Rojas magallanes 3630, Depto. 5" -- a real Strip La
  // Florida Spa boleta whose header line got missed/garbled by OCR fell
  // through to this address line as its "comercio" instead. Same idea as
  // 'suc'/'av'/'calle' above, just a different chain's wording for it.
  // 'depto' is its own entry (not just relying on 'casa matriz' above)
  // because a real device capture OCR'd "CASA MATRIZ" as "CASA NATRIZ" (m
  // -> n, not in OCR_CONFUSION_MAP, and 'casa matriz' is multi-word so it
  // gets no Levenshtein fallback -- see fuzzyLineIncludes) -- 'depto' alone
  // still catches that exact line via its own unambiguous match.
  'casa matriz',
  'depto',
  // Plain document-type boilerplate ("Recibo" / "Ticket" / "Comprobante"
  // printed alone as the very first line) -- a real Central Parking System
  // receipt starts with a bare "Recibo" line, and OCR noise ("Reci bo",
  // an inserted stray space) used to slip past the exact/homogenized
  // check and get returned as the comercio name outright. 'comprobante' was
  // already covered above; 'recibo'/'ticket' are the missing ones.
  'recibo',
  'ticket',
  // "Conuna: LA FLORIDA - Ciudad:" -- OCR's own misread of "Comuna:" -- is
  // an address-locality line, never a business name. Not previously in this
  // list at all (only BRANCH_METADATA_KEYWORDS had 'comuna', which
  // extractDocumentItems uses, not the comercio header loop below): once a
  // "GIRO:" line is correctly skipped via GIRO_LINE_PATTERN, this was the
  // very next header line and would otherwise become the wrong "comercio"
  // in its place.
  'comuna',
];

// OCR sometimes drops the leading "G" from "GIRO:" entirely -- a real Strip
// La Florida Spa boleta reads "IRO: NELADERIA, CAFETERIA Y PASTELERIA"
// (also losing the "H" from "HELADERIA" along the way). HEADER_SKIP_KEYWORDS'
// own 'giro' entry can't catch this: it's only 4 characters, which
// maxEditDistanceFor deliberately gives zero Levenshtein slack (see its own
// comment), so "iro" never fuzzily matches "giro" there. A dedicated,
// tightly-anchored pattern is safer than just adding a bare 'iro' keyword
// (3 characters, far too short and collision-prone to match anywhere in a
// line) -- this only matches "[G]IRO" followed by a colon at the very START
// of a line, the one shape a real "Giro:" field actually takes.
const GIRO_LINE_PATTERN = /^g?iro\s*:/i;

// A branch/lot number marker ("#8968", "N° 123") is a strong, independent
// signal that a header line is an address, even on a line HEADER_SKIP_KEYWORDS
// doesn't otherwise catch (e.g. "SANCHEZ FONTECILLA #8968" has no fiscal
// keyword on it at all once "SUC:" is trimmed away by upstream OCR).
const ADDRESS_NUMBER_PATTERN = /#\d|n[°º]\s*\d/i;

// Branch/register/administrative metadata -- "Local:"/"Caja:" labels (real
// Unimarc OCR reads them as "Lecel:"/"CajB:") and their comuna/depto/casa-
// matriz neighbors are never a purchased item or a note worth keeping, even
// though a line like "Lecel: 912 CajB: 82" structurally matches
// ITEM_LINE_PATTERN just as well as a real item (a short label followed by
// a small number). "caja"/"cajb" are kept as their own literal keywords
// (not left to fuzzy matching) because they're only 4 characters --
// fuzzyLineIncludes gives 4-char-or-shorter keywords zero Levenshtein slack
// (see maxEditDistanceFor's own comment), so the "caja" -> "cajb" OCR
// misread would otherwise never match.
const BRANCH_METADATA_KEYWORDS = [
  'local',
  'lecal',
  'lecel',
  'caja',
  'cajb',
  'sucursal',
  'cajero',
  'comuna',
  'casa matriz',
  'depto',
];

// A short branch/store code like "S605" in "EL PLOMO S605 711" -- a letter
// immediately followed by 3-4 digits, independent of any keyword above, is
// a strong structural signal of a branch/register code rather than an item
// or a note (same idea as ADDRESS_NUMBER_PATTERN above, different shape).
const BRANCH_CODE_PATTERN = /\b[A-Z]\d{3,4}\b/;

// Fields that carry a long/structured number but are NEVER the transaction
// amount -- RUT is already handled separately (RUT_TOKEN_PATTERN/'rut'
// below), this covers the rest: phone numbers, product/SKU/PLU codes, and
// a boleta's own folio ("BOLETA N° 66950"). A line built entirely around
// one of these must never become a fallback amount candidate, no matter
// how large or well-formatted the number next to it looks.
const FALSE_POSITIVE_LABEL_KEYWORDS = ['telefono', 'codigo', 'plu', 'sku', 'boleta n', 'folio'];

// A standalone 12-14 digit run is unambiguously an EAN/UPC product barcode
// (a real peso amount never has that many digits), most often seen
// prefixing an item description on a Unimarc-style receipt row
// ("7802225640558 GALLETA RIGOCHOC 1") -- stripBarcodePrefix below removes
// just that token so the barcode itself never ends up in Notas, and this
// pattern independently keeps a barcode-only line out of amount candidacy.
const BARCODE_PATTERN = /\b\d{12,14}\b/;

/** Removes a standalone EAN/UPC-style barcode token from `line` (see BARCODE_PATTERN) -- never touches a shorter or thousands-grouped number, only an unbroken run this long is unambiguously a barcode rather than a price or quantity. A no-op (original spacing untouched) when there's no barcode to remove, so it never reformats an ordinary item line's own column spacing. */
function stripBarcodePrefix(line: string): string {
  if (!BARCODE_PATTERN.test(line)) return line;
  return line.replace(BARCODE_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
}

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

// A parking/estacionamiento receipt almost always names both the operating
// company (a generic legal entity like "Central Parking System S.A.") AND
// the actual venue/recinto ("PARKING MALL PLAZA VESPUCIO") -- the venue is
// what the person actually wants to see as "comercio" ("where did I park?",
// not "which company processed the payment?"), so this is tried BEFORE the
// MERCHANT_ALIASES operator-name fallback below, not after. The word right
// after PARKING/ESTACIONAMIENTO has to NOT be one of these generic
// descriptors -- "Central Parking System" (followed by "System"),
// "Estacionamiento de Automoviles" (followed by "de") -- for a line to
// count as a real venue name; "PARKING MALL PLAZA VESPUCIO" (followed by
// "MALL", a real place) passes through untouched. \b(...)\b on
// "estacionamiento" deliberately never matches the plural
// "Estacionamientos" ("Adm. de Estacionamientos", generic boilerplate), a
// free side effect of the word-boundary requirement.
const PARKING_GENERIC_FOLLOWERS = ['de', 'del', 'la', 'los', 'system', 'automoviles', 'vehicular', 'vehiculos'];
const PARKING_KEYWORD_PATTERN = /\b(?:parking|estacionamiento|garage)\b\s+([a-zA-ZÀ-ÿ0-9]+)/i;

// A legal-entity suffix ("S.A.", "SPA", "LTDA", "EIRL") anywhere on the SAME
// line as the parking keyword means this is the operator's razón social,
// never a venue name -- independent of whether the immediate next word
// happens to be in PARKING_GENERIC_FOLLOWERS above. This matters because
// that list is an exact/normalized match, and a real receipt reads
// "Central Parking Systen S. A." (OCR dropping the "m" from "System"):
// "systen" never equals "system" character-for-character, so without this
// check that header line would win outright over "PARKING MALL PLAZA
// VESPUCIO" further down the document, exactly the bug reported on a real
// device against this exact receipt.
const LEGAL_ENTITY_SUFFIX_PATTERN = /\b(?:s\.?\s?a\.?|spa|ltda\.?|e\.?i\.?r\.?l\.?)\s*$/i;

function extractParkingVenue(text: string): string | null {
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(PARKING_KEYWORD_PATTERN);
    if (!match) continue;
    if (PARKING_GENERIC_FOLLOWERS.includes(normalize(match[1]))) continue;
    if (LEGAL_ENTITY_SUFFIX_PATTERN.test(line)) continue;
    return line;
  }
  return null;
}

const MERCHANT_ALIASES: MerchantAlias[] = [
  // Parking operators checked BEFORE mall names: a parking receipt almost
  // always mentions both ("Central Parking System S.A." near the header,
  // "PARKING MALL PLAZA VESPUCIO" further down describing which mall it's
  // AT) -- the operator that actually ran the transaction is the more
  // useful "comercio" than the mall it happens to be located in.
  { name: 'Central Parking System', keywords: ['central parking', 'parking system'] },
  { name: 'AutoPark', keywords: ['autopark', 'auto park'] },
  { name: 'Lider', keywords: ['lider', 'lider.cl', 'mi club', 'precios bajos todos los dias'] },
  { name: 'Jumbo', keywords: ['jumbo', 'jumbo.cl', 'cencosud', 'puntos cencosud'] },
  { name: 'Santa Isabel', keywords: ['santa isabel', 'santaisabel.cl'] },
  { name: 'Unimarc', keywords: ['unimarc', 'club unimarc'] },
  { name: 'Salcobrand', keywords: ['salcobrand', 'sb.cl'] },
  { name: 'Cruz Verde', keywords: ['cruz verde', 'cruzverde.cl'] },
  { name: 'Farmacias Ahumada', keywords: ['farmacias ahumada', 'ahumada'] },
  { name: 'Falabella', keywords: ['falabella', 'falabella.com', 'cmr'] },
  { name: 'Paris', keywords: ['paris', 'paris.cl'] },
  // Chilean shopping malls -- a parking/food-court/retail receipt inside
  // one of these often only clearly OCRs the mall's own name, not whichever
  // small store issued it.
  { name: 'Mall Plaza', keywords: ['mall plaza', 'plaza vespucio', 'plaza egana', 'plaza oeste', 'plaza norte'] },
  { name: 'Mall Florida Center', keywords: ['florida center'] },
  { name: 'Costanera Center', keywords: ['costanera center'] },
  { name: 'Parque Arauco', keywords: ['parque arauco'] },
  { name: 'Malls de Chile', keywords: ['malls de chile'] },
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

// Every "grouped" alternative below uses `+` (at least one separator+3-digit
// repeat), never `*` (zero-or-more) -- with `*`, the FIRST alternative
// `\d{1,3}(?:[.,]\d{3})*...` is satisfied by just the first 1-3 digits of an
// UNGROUPED number the instant no separator follows (its own `*` is happy
// with zero repetitions), so a bare "7470" with no thousands separator at
// all -- extremely common once OCR drops the "." -- silently truncates to
// "747": alternation accepts the first alternative that matches AT ALL, it
// doesn't hold out for the longest one, and a bounded `{1,3}` quantifier has
// nothing left to backtrack into for the remaining digits. AMOUNT_PATTERN's
// trailing `\b` happens to force a backtrack to the second, ungrouped `\d+`
// alternative in most cases (a digit followed by another digit is never a
// boundary) and AMOUNT_WITH_CLP's mandatory " CLP" suffix has the same
// protective effect -- but AMOUNT_WITH_SIGN has neither, so this used to be
// a real, silent bug there: a real Unimarc receipt's own bare "$7470" (no
// separator) was truncating to $747. Requiring `+` makes the "grouped"
// alternative only ever match when a genuine separator-delimited group is
// actually present, so a separator-less run correctly falls through to the
// unbounded `\d+` alternative instead -- the same shape AMOUNT_GROUPED
// already used correctly.
//
// Global so firstMatch (via matchAll) can read it -- .matchAll() throws on a
// non-global regex.
const AMOUNT_PATTERN = /\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\b/g;
// Anywhere-in-text fallbacks (same shapes bankNotificationParser looks for
// in push-notification text), used only when no labeled line has an amount
// -- global so collectFallbackAmounts (see extractDocumentAmount) can weigh
// every candidate on the page instead of just the first one found.
const AMOUNT_WITH_SIGN = /\$\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/g;
const AMOUNT_WITH_CLP = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*CLP\b/gi;
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
// Anchored to the START of a line (the 'm' flag): a bare "de"/"para" is too
// common a Spanish word to safely match mid-line anywhere in a whole
// receipt's running text -- a real boleta's own boilerplate ("El IVA DE
// esta boleta es $618") used to satisfy this unanchored, once every header
// line was correctly excluded elsewhere, returning nonsense text as the
// comercio instead of correctly falling through to null.
const RECIPIENT_LABEL_PATTERN = /^\s*(?:para|destinatario|beneficiario|de)\s*:?\s+([A-ZÁÉÍÓÚÑ][^\n]{1,40})/im;

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
  if (fuzzyKeywordMatch(line, BRANCH_METADATA_KEYWORDS) || BRANCH_CODE_PATTERN.test(line)) return true;
  if (fuzzyKeywordMatch(line, FALSE_POSITIVE_LABEL_KEYWORDS)) return true;
  if (RUT_TOKEN_PATTERN.test(line) || fuzzyLineIncludes(line, 'rut')) return true;
  if (DATE_PATTERN_DMY.test(line) || DATE_PATTERN_YMD.test(line) || TIME_PATTERN.test(line)) return true;
  // A line that's JUST a barcode (nothing left once it's stripped out, and
  // no $ sign/thousands-grouping either) is never itself an amount
  // candidate -- a real price line always carries one of those. Deliberately
  // narrow: a barcode PREFIXING a real item description ("7802225640558
  // GALLETA RIGOCHOC 1") must still reach extractDocumentItems below (which
  // strips just the barcode token itself via stripBarcodePrefix) rather than
  // being thrown out wholesale here.
  if (BARCODE_PATTERN.test(line) && !/[$.,]/.test(line)) {
    const withoutBarcode = line.replace(BARCODE_PATTERN, '').trim();
    if (withoutBarcode.length < 3) return true;
  }
  return false;
}

/** First regex match (with capture groups intact) regardless of whether `pattern` carries the global flag -- .match() silently drops capture groups on a global regex, so this is the only safe way to grab group 1 from our shared global amount patterns. */
function firstMatch(text: string, pattern: RegExp): RegExpMatchArray | null {
  const result = text.matchAll(pattern).next();
  return result.done ? null : result.value;
}

/**
 * True when `match` (from one of the AMOUNT_* patterns, which never capture
 * a leading sign themselves) is immediately preceded by a "-" in `text` --
 * "-$1.350", "Club Unimarc CCU -$700", "$-700". Every one of these is a
 * discount/adjustment subtracted from the real total, never the total
 * itself, and the amount patterns' own capture group silently drops that
 * minus sign -- without this check, "-$1.350" reads as a perfectly valid
 * positive $1.350 candidate. This is what a real Unimarc receipt's own
 * "Club Unimarc" per-item discount lines look like once OCR's line
 * detection has separated them from their real item/label context (see
 * findLastLabeledAmount's own comment on that scrambling), and is the
 * actual root cause behind a stray "-$1.350" outranking the real $7.470
 * total on that receipt -- not the (already independently excluded, via
 * EXCLUDED_AMOUNT_KEYWORDS' own 'ahorro' entry) "TOTAL AHORRO HOY" label
 * line itself.
 */
function isNegativeAmountMatch(text: string, match: RegExpMatchArray): boolean {
  const index = match.index ?? 0;
  return /-\s*$/.test(text.slice(0, index));
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

// And the other end of the same guard: no real personal purchase/boleta
// this app will ever scan gets anywhere near this. Exists specifically so
// a misread RUT/phone/barcode digit run that happens to fall through with
// stray "."/","-shaped punctuation can never win the "largest amount"
// fallback just for being numerically huge.
const MAX_PLAUSIBLE_AMOUNT = 50_000_000;

/** Every $X / X CLP / thousands-grouped amount found on a non-excluded line, within [minAmount, MAX_PLAUSIBLE_AMOUNT]. */
function collectFallbackAmounts(text: string, minAmount: number): number[] {
  const amounts: number[] = [];
  for (const line of text.split('\n')) {
    if (isExcludedAmountLine(line)) continue;
    const stripped = stripPercentages(line);
    for (const pattern of [AMOUNT_WITH_SIGN, AMOUNT_WITH_CLP, AMOUNT_GROUPED]) {
      for (const match of stripped.matchAll(pattern)) {
        if (isNegativeAmountMatch(stripped, match)) continue;
        const amount = parseAmount(match[1]);
        if (amount >= minAmount && amount <= MAX_PLAUSIBLE_AMOUNT) amounts.push(amount);
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
  if (withSign && !isNegativeAmountMatch(stripped, withSign)) {
    const amount = parseAmount(withSign[1]);
    if (amount >= MIN_PLAUSIBLE_AMOUNT) return amount;
  }
  const grouped = firstMatch(stripped, AMOUNT_GROUPED);
  if (grouped && !isNegativeAmountMatch(stripped, grouped)) {
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
 *   1a. An explicit "TOTAL"/"TOTAL A PAGAR"/"TOTAL PAGAR" line
 *       (STRONG_TOTAL_LABEL_KEYWORDS), tried first and independent of where
 *       it sits in the document -- see that constant's own comment for why
 *       this needs its own pass instead of being folded into 1b.
 *   1b. No explicit total line at all -- the wider label set ("monto",
 *      "importe", "a pagar", "debito"/"credito" -- never a fuzzily-excluded
 *      "subtotal"/"neto"/"iva"/"total ahorrado"/etc line, see
 *      EXCLUDED_AMOUNT_KEYWORDS), checking that same line and, at most, the
 *      ONE immediately following
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
/**
 * Every amount found on a line fuzzily matching one of `labelKeywords`
 * (checking that line and, at most, the ONE immediately following line for
 * the actual number -- see extractDocumentAmount's own comment for why not
 * further) -- ALL of them, in document order, not just the first or last.
 */
function collectLabeledAmounts(lines: string[], labelKeywords: string[]): number[] {
  const amounts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || isExcludedAmountLine(line)) continue;
    if (!fuzzyKeywordMatch(line, labelKeywords)) continue;

    for (const candidate of [line, lines[i + 1]]) {
      if (!candidate || isExcludedAmountLine(candidate)) continue;
      const stripped = stripPercentages(candidate);
      const match = firstMatch(stripped, AMOUNT_PATTERN);
      if (!match || isNegativeAmountMatch(stripped, match)) continue;
      const amount = parseAmount(match[1]);
      if (amount < MIN_PLAUSIBLE_AMOUNT || amount > MAX_PLAUSIBLE_AMOUNT) continue;
      const isSameLine = candidate === line;
      if (!isSameLine && !/[$.,]/.test(match[0])) continue;
      amounts.push(amount);
      break;
    }
  }

  return amounts;
}

/**
 * Shared by both label tiers of extractDocumentAmount: the value
 * CORROBORATED by the most independent labeled lines wins, not simply
 * whichever labeled line happens to come last in the document. A real
 * Chilean boleta restates its final total 2-4 times under different labels
 * ("TOTAL $7470", "TARJETA $7470", "MONTO $7.470", "TOTAL $7.470" on one
 * real Unimarc receipt) -- picking "whichever labeled match is last" trusts
 * a single occurrence exactly as much as one repeated three times, so one
 * OCR misread on an otherwise-unambiguous receipt (a line/number pairing
 * that gets fuzzily mislabeled, or an item price that happens to sit right
 * after a stray label-shaped word) can silently outrank the real total just
 * by landing later in the raw text. Ties (including "every value seen
 * exactly once") fall back to last-occurrence, same as the old behavior.
 */
function pickMostCorroboratedAmount(amounts: number[]): number | null {
  if (amounts.length === 0) return null;

  const counts = new Map<number, number>();
  for (const amount of amounts) counts.set(amount, (counts.get(amount) ?? 0) + 1);

  let best: number | null = null;
  let bestCount = 0;
  for (const amount of amounts) {
    const count = counts.get(amount)!;
    // >= (not >) so a later occurrence still wins a tie -- preserves the
    // original "last one wins" tie-break when every candidate is equally
    // (un)corroborated.
    if (count >= bestCount) {
      bestCount = count;
      best = amount;
    }
  }
  return best;
}

/** Convenience wrapper: the most-corroborated amount among labeled matches, or null if there were none at all. */
function findLastLabeledAmount(lines: string[], labelKeywords: string[]): number | null {
  return pickMostCorroboratedAmount(collectLabeledAmounts(lines, labelKeywords));
}

/**
 * The peso figure on a "*Descuento: Descuento Global $ 430"-style line, if
 * any -- used only by applyDiscount below, NEVER as an amount candidate
 * itself (a discount line is already unconditionally excluded via
 * EXCLUDED_AMOUNT_KEYWORDS' own 'descuento' entry).
 */
function extractDiscountAmount(text: string): number | null {
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || !fuzzyKeywordMatch(line, ['descuento'])) continue;
    const match = firstMatch(stripPercentages(line), AMOUNT_PATTERN);
    if (!match) continue;
    const amount = parseAmount(match[1]);
    if (amount > 0 && amount <= MAX_PLAUSIBLE_AMOUNT) return amount;
  }
  return null;
}

/**
 * Corrects a Tier 1b/2/3 fallback amount for a discount that was applied
 * AFTER it -- Chilean boletas print `unitario x cantidad`, then
 * `*Descuento: ... $430`, then a `TOTAL` equal to (item price - descuento).
 * Deliberately never applied to Tier 1a (an explicit STRONG_TOTAL_LABEL
 * match, returned before this is ever called): that tier already found the
 * real post-discount figure directly off a "TOTAL"-labeled line, and
 * subtracting again would double-count it.
 *
 * This only matters once Tier 1a has already failed to pair "TOTAL" with a
 * number at all -- which is exactly what happens on a real Strip La Florida
 * Spa boleta: ML Kit's line detection splits the receipt's aligned
 * "Unitario | Valor" columns apart from the row they describe, so "TOTAL"
 * (itself OCR'd as "T01AL") ends up 2+ unrelated lines away from any
 * number, out of reach of the normal same-line/next-line lookahead. What
 * DOES get picked by the fallback tiers in that case is the item's
 * pre-discount price (4.300, repeated twice as both "Unitario" and "Valor"
 * for a single-quantity item) -- subtracting the discount recovers the real
 * charged total ($3.870) without needing to parse the receipt's own
 * "TOTAL" number at all, which on this exact receipt OCR corrupted into an
 * unparseable "3.8710" token anyway (a stray extra digit breaks every
 * amount pattern's trailing word-boundary check).
 */
function applyDiscount(amount: number, discount: number | null): number {
  if (discount === null) return amount;
  const discounted = amount - discount;
  return discounted >= MIN_PLAUSIBLE_AMOUNT ? discounted : amount;
}

export function extractDocumentAmount(text: string): number | null {
  const lines = text.split('\n').map((l) => l.trim());

  // Tier 1a: an explicit "TOTAL"/"TOTAL A PAGAR"/"TOTAL PAGAR" line, tried
  // FIRST and independent of document order -- see
  // STRONG_TOTAL_LABEL_KEYWORDS's own comment for why this has to outrank
  // Tier 1b rather than just being folded into the same last-match-wins
  // list.
  const strongTotal = findLastLabeledAmount(lines, STRONG_TOTAL_LABEL_KEYWORDS);
  if (strongTotal !== null) return strongTotal;

  // Everything below is a fallback that may have landed on a PRE-discount
  // price instead of the real total -- see applyDiscount's own comment.
  const discount = extractDiscountAmount(text);

  // Tier 1b: no explicit total line on the page at all -- the wider label
  // set (monto/importe/a pagar/debito/credito), for transfer confirmations
  // and vales that never say "total".
  const found = findLastLabeledAmount(lines, AMOUNT_LABEL_KEYWORDS);
  if (found !== null) return applyDiscount(found, discount);

  const duplicate = findConsecutiveDuplicateAmount(text);
  if (duplicate !== null) return applyDiscount(duplicate, discount);

  const plausible = collectFallbackAmounts(text, MIN_PLAUSIBLE_AMOUNT);
  if (plausible.length > 0) return applyDiscount(Math.max(...plausible), discount);

  // Absolute last resort: the image had SOME legible number, just none of
  // it looked like a normal-sized peso amount -- still better than nothing.
  const anyAmount = collectFallbackAmounts(text, 1);
  return anyAmount.length > 0 ? applyDiscount(Math.max(...anyAmount), discount) : null;
}

/**
 * Priority order:
 *   1. A colon-labeled "Destinatario:"/"Para:"/"Beneficiario:" field (see
 *      LABELED_RECIPIENT_PATTERN's own comment for why it wins outright).
 *   2. A parking/estacionamiento venue name (see extractParkingVenue) --
 *      "PARKING MALL PLAZA VESPUCIO", not the generic operator company.
 *   3. A known Chilean chain (see MERCHANT_ALIASES), searched across the
 *      WHOLE text -- on a real boleta the header is usually just the legal
 *      entity/branch/address ("SUC: SANCHEZ FONTECILLA #8968", "SII SANTIAGO
 *      SUR"), while the actual brand name/URL/loyalty program mention
 *      ("revisa tu boleta en WWW.LIDER.CL", "PUNTOS CENCOSUD") is often
 *      buried mid-receipt or in the footer -- a header-only search would
 *      never reach it. Also where a parking operator (Central Parking
 *      System, AutoPark) falls back to if no clean venue line was found.
 *   4. The first header-area line that reads like a business/person name,
 *      rather than a RUT, date, address or boilerplate label.
 *   5. A looser "para/de NAME" match anywhere in the text, for transfer-
 *      style running text where the name never sits in the header.
 * Null when nothing is confident enough -- callers fall back to "Comercio
 * no detectado".
 */
export function extractDocumentComercio(text: string): string | null {
  const labeledMatch = text.match(LABELED_RECIPIENT_PATTERN);
  if (labeledMatch) return labeledMatch[1].trim();

  // A parking/estacionamiento ticket names the specific venue -- see
  // extractParkingVenue's own comment for why this outranks the generic
  // operator name below.
  const parkingVenue = extractParkingVenue(text);
  if (parkingVenue) return parkingVenue;

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
    if (GIRO_LINE_PATTERN.test(line)) continue;
    if (fuzzyKeywordMatch(line, HEADER_SKIP_KEYWORDS)) continue;
    // A stray space OCR inserts mid-word ("Reci bo" for "RECIBO") defeats
    // fuzzyKeywordMatch above: it splits the line into per-word tokens
    // first, and neither "reci" nor "bo" alone is within edit distance of
    // "recibo". Only tried on a SHORT line (a real multi-word business name
    // is never this short) -- collapsing all whitespace and re-checking
    // turns "reci bo" back into one "recibo" token, an exact match once
    // normalized, without risking a false positive on a real store name.
    if (line.length <= 15 && fuzzyKeywordMatch(line.replace(/\s+/g, ''), HEADER_SKIP_KEYWORDS)) continue;
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
    // Redundant with isExcludedAmountLine above for most cases, but kept
    // explicit here too: a branch/register/address fragment must never
    // leak into "items detectados" (and, from there, straight into the
    // Notas prefill) even on a line isExcludedAmountLine wouldn't otherwise
    // reject on its own merits.
    if (fuzzyKeywordMatch(line, BRANCH_METADATA_KEYWORDS) || BRANCH_CODE_PATTERN.test(line)) continue;
    if (ITEM_LINE_PATTERN.test(line)) {
      // A Unimarc-style row prints the item's own EAN/UPC barcode right
      // before its description ("7802225640558 GALLETA RIGOCHOC 1") -- the
      // line still legitimately matches ITEM_LINE_PATTERN (real product +
      // quantity), it just needs the barcode token itself stripped out
      // before it lands in "items detectados" and, from there, Notas.
      const cleaned = stripBarcodePrefix(line);
      if (!cleaned) continue;
      items.push(cleaned);
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
