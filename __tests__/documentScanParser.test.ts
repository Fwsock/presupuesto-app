import {
  looksLikeScannedDocument,
  cleanScannedText,
  extractDocumentAmount,
  extractDocumentComercio,
  extractDocumentDate,
  extractDocumentItems,
  extractDocumentType,
  parseScannedDocument,
} from '../lib/parsers/documentScanParser';

const BOLETA_TEXT = `SUPERMERCADO LIDER
RUT: 12.345.678-9
BOLETA ELECTRONICA
12/08/2026
PAN                 $1.500
LECHE                 $990
SUBTOTAL            $2.490
IVA                   $473
TOTAL               $2.490`;

const TRANSFER_TEXT = `Transferencia exitosa
Monto transferido: $50.000
Para: Juan Perez
Fecha: 10/08/2026`;

// Modeled after real ML Kit output for a photographed/OCR'd bank
// notification: each visual line comes back as its own text line, never one
// run-on sentence.
const NOTIFICATION_STYLE_TEXT = `Recibiste $30.000
de Maria Gomez
05/08/2026`;

const VALE_TEXT = `Vale de compra
Bazar Don Pedro
A pagar $4.500`;

describe('looksLikeScannedDocument', () => {
  it('accepts a printed boleta', () => {
    expect(looksLikeScannedDocument(BOLETA_TEXT)).toBe(true);
  });

  it('accepts a transfer confirmation screenshot', () => {
    expect(looksLikeScannedDocument(TRANSFER_TEXT)).toBe(true);
  });

  it('accepts a bank push-notification-style text', () => {
    expect(looksLikeScannedDocument(NOTIFICATION_STYLE_TEXT)).toBe(true);
  });

  it('accepts a small comercio vale', () => {
    expect(looksLikeScannedDocument(VALE_TEXT)).toBe(true);
  });

  it('rejects short/blank OCR text', () => {
    expect(looksLikeScannedDocument('hola')).toBe(false);
    expect(looksLikeScannedDocument('')).toBe(false);
  });

  it('rejects promotional bank copy even if long enough', () => {
    expect(looksLikeScannedDocument('Solicita tu credito preaprobado hoy mismo y recibe $500.000')).toBe(false);
  });

  it('rejects text with no signal keyword and no extractable amount', () => {
    expect(looksLikeScannedDocument('una fotografia cualquiera sin datos financieros aqui')).toBe(false);
  });
});

describe('extractDocumentAmount', () => {
  it('reads the TOTAL line on a boleta, excluding SUBTOTAL/IVA', () => {
    expect(extractDocumentAmount(BOLETA_TEXT)).toBe(2490);
  });

  it('reads a "Monto transferido" labeled line', () => {
    expect(extractDocumentAmount(TRANSFER_TEXT)).toBe(50000);
  });

  it('reads an "A pagar" labeled line', () => {
    expect(extractDocumentAmount(VALE_TEXT)).toBe(4500);
  });

  it('falls back to a bare $ amount when no labeled line exists', () => {
    expect(extractDocumentAmount(NOTIFICATION_STYLE_TEXT)).toBe(30000);
  });

  it('returns null when no amount is present at all', () => {
    expect(extractDocumentAmount('sin ningun monto en este texto')).toBeNull();
  });
});

describe('extractDocumentComercio', () => {
  it('reads the business name from a boleta header', () => {
    expect(extractDocumentComercio(BOLETA_TEXT)).toBe('Lider');
  });

  it('reads the recipient from a "Para:" labeled line, without the label', () => {
    expect(extractDocumentComercio(TRANSFER_TEXT)).toBe('Juan Perez');
  });

  it('reads the recipient from "de NAME" push-notification-style text', () => {
    expect(extractDocumentComercio(NOTIFICATION_STYLE_TEXT)).toBe('Maria Gomez');
  });

  it('reads the business name from a small vale', () => {
    expect(extractDocumentComercio(VALE_TEXT)).toBe('Bazar Don Pedro');
  });
});

describe('extractDocumentDate', () => {
  it('reads a DD/MM/YYYY date', () => {
    expect(extractDocumentDate(BOLETA_TEXT)).toBe('2026-08-12');
  });

  it('reads a DD-MM-YYYY date', () => {
    expect(extractDocumentDate('Fecha: 10-08-2026')).toBe('2026-08-10');
  });

  it('reads a DD/MM/YY date, expanding to the 2000s', () => {
    expect(extractDocumentDate('10/08/26')).toBe('2026-08-10');
  });

  it('returns null when there is no date-shaped text', () => {
    expect(extractDocumentDate('sin fecha aqui')).toBeNull();
  });

  it('returns null for an impossible calendar date instead of rolling it over', () => {
    expect(extractDocumentDate('31/02/2026')).toBeNull();
  });

  it('does not misread a RUT as a date', () => {
    expect(extractDocumentDate('RUT: 12.345.678-9')).toBeNull();
  });
});

describe('extractDocumentType', () => {
  it('detects ingreso language', () => {
    expect(extractDocumentType(NOTIFICATION_STYLE_TEXT)).toBe('ingreso');
  });

  it('detects gasto language', () => {
    expect(extractDocumentType('Transferiste $10.000 a Pedro')).toBe('gasto');
  });

  it('returns null when the text has no clear ingreso/gasto language', () => {
    expect(extractDocumentType(BOLETA_TEXT)).toBeNull();
  });
});

describe('extractDocumentItems', () => {
  it('reads product/price lines from a boleta, skipping the total/subtotal/iva lines', () => {
    const items = extractDocumentItems(BOLETA_TEXT);
    expect(items).toEqual(['PAN                 $1.500', 'LECHE                 $990']);
  });
});

// Simulates a real Jumbo/Salcobrand-style boleta where OCR only picked up
// the payment-method/footer lines clearly -- the store header, RUT and the
// literal word "TOTAL"/"BOLETA" were lost to glare/blur/background clutter
// (a table edge, a finger holding the paper), which is exactly the kind of
// noisy photo the parser needs to still recognize.
const NOISY_RECEIPT_TEXT = `xxxx yyyy zzzz
####
DETERGENTE           $5.990
ARROZ 1KG             $1.290
|
NETO                 $6.117
IVA                   $1.163
T. DEBITO            $7.280
GRACIAS POR SU COMPRA`;

describe('looksLikeScannedDocument (noisy real-world receipts)', () => {
  it('accepts a receipt whose header/RUT/TOTAL got lost to OCR noise, via payment-method and footer wording', () => {
    expect(looksLikeScannedDocument(NOISY_RECEIPT_TEXT)).toBe(true);
  });
});

describe('extractDocumentAmount (noisy real-world receipts)', () => {
  it('reads the T. DEBITO amount, never the NETO (pre-IVA) amount', () => {
    expect(extractDocumentAmount(NOISY_RECEIPT_TEXT)).toBe(7280);
  });
});

describe('cleanScannedText', () => {
  it('drops garbage lines with no real letters/digits', () => {
    expect(cleanScannedText('hola\n|\n—\n.\nmundo')).toBe('hola\nmundo');
  });

  it('keeps short but meaningful lines like RUT/IVA/prices', () => {
    expect(cleanScannedText('IVA\n$990\n*')).toBe('IVA\n$990');
  });

  it('does not change already-clean text', () => {
    expect(cleanScannedText(BOLETA_TEXT)).toBe(BOLETA_TEXT);
  });
});

describe('parseScannedDocument', () => {
  it('combines every field for a boleta', () => {
    expect(parseScannedDocument(BOLETA_TEXT)).toEqual({
      monto: 2490,
      comercio: 'Lider',
      fecha: '2026-08-12',
      tipo: null,
    });
  });

  it('combines every field for a transfer confirmation', () => {
    expect(parseScannedDocument(TRANSFER_TEXT)).toEqual({
      monto: 50000,
      comercio: 'Juan Perez',
      fecha: '2026-08-10',
      tipo: null,
    });
  });
});

// ===========================================================================
// Production-hardening battery: real Chilean chains (clean OCR), the same
// receipts with realistic OCR corruption (glare/shadow/angle -- the exact
// failure mode reported against real Jumbo/Salcobrand photos), fuzzy-match
// safety nets, cautious "largest amount" fallback, and Chilean number-format
// sanitization. Every fixture's expected values below were traced by hand
// against the parser's actual matching rules before being asserted.
// ===========================================================================

const JUMBO_CLEAN_TEXT = `JUMBO CENCOSUD
AV. PROVIDENCIA 1234
RUT: 96.756.430-3
BOLETA ELECTRONICA
15/07/2026
DETERGENTE OMO 3KG      $6.990
PAPEL CONFORT X12       $3.490
COCA COLA 1.5L          $1.590
SUBTOTAL               $12.070
TOTAL                  $12.070
T. DEBITO              $12.070
GRACIAS POR SU COMPRA`;

// Same receipt, but with the OCR corruption a real angled/shadowed photo
// produces: '0' for 'O', '5' for 'S', '8' for 'B' -- the exact confusions
// named in the request -- scattered across the header/footer, never on the
// item prices themselves (ML Kit rarely misreads a clean printed digit run,
// it misreads the surrounding LETTERS from glare on that part of the paper).
const JUMBO_NOISY_TEXT = `JUMB0 CENC0SUD
R5T: 96.756.430-3
B0LETA ELECTR0NICA
15/07/2026
DETERGENTE OMO 3KG      $6.990
PAPEL CONFORT X12       $3.490
COCA COLA 1.5L          $1.590
5UBTOTAL               $12.070
T0TAL                  $12.070
T. DE8ITO              $12.070
GRACIA5 POR 5U COMPRA`;

const SALCOBRAND_CLEAN_TEXT = `FARMACIAS SALCOBRAND
RUT: 96.874.030-5
BOLETA ELECTRONICA
02/03/2026
PARACETAMOL 500MG        $2.190
ALCOHOL GEL 250ML        $1.990
NETO                     $3.529
IVA                      $671
TOTAL                    $4.180
TARJETA CREDITO          $4.180`;

// Realistic phone-camera noise: the store header and the word "BOLETA" are
// completely lost (a finger/shadow across the top of the paper), and RUT is
// unreadable -- only the item lines, NETO/IVA/TOTAL breakdown and payment
// method survived clearly, same as many real low-light pharmacy receipts.
const SALCOBRAND_NOISY_TEXT = `xxxxxxxxxx xxxxxxxxx
............
PARACETAMOL 500MG        $2.190
ALCOHOL GEL 250ML        $1.990
NET0                     $3.529
1VA                      $671
T0TAL                    $4.180
TARJETA CRED1TO          $4.180`;

const LIDER_TRANSFER_APP_TEXT = `Banco Estado
Comprobante de transferencia
Monto: $18.500
Destinatario: Farmacia Cruz Verde
15-07-2026 09:41`;

// No labeled line at all (a torn/partial receipt, or OCR that missed every
// word but still read the numbers) -- extraction must fall back to the
// LARGEST amount on the page, not merely the first number it stumbles on
// (the naive-regex failure mode this fallback exists to avoid).
const NO_LABEL_MULTI_AMOUNT_TEXT = `PAN INTEGRAL           $1.200
QUESO LAMINADO          $3.450
YOGUR NATURAL           $890
$8.760`;

describe('real Chilean chain receipts -- clean OCR', () => {
  it('recognizes a clean Jumbo boleta end to end', () => {
    expect(looksLikeScannedDocument(JUMBO_CLEAN_TEXT)).toBe(true);
    expect(parseScannedDocument(JUMBO_CLEAN_TEXT)).toEqual({
      monto: 12070,
      comercio: 'Jumbo',
      fecha: '2026-07-15',
      tipo: 'gasto',
    });
  });

  it('recognizes a clean Salcobrand boleta end to end', () => {
    expect(looksLikeScannedDocument(SALCOBRAND_CLEAN_TEXT)).toBe(true);
    expect(parseScannedDocument(SALCOBRAND_CLEAN_TEXT)).toEqual({
      monto: 4180,
      comercio: 'Salcobrand',
      fecha: '2026-03-02',
      tipo: null,
    });
  });

  it('recognizes a bank-app transfer confirmation naming a Cruz Verde destination', () => {
    expect(looksLikeScannedDocument(LIDER_TRANSFER_APP_TEXT)).toBe(true);
    expect(parseScannedDocument(LIDER_TRANSFER_APP_TEXT)).toEqual({
      monto: 18500,
      comercio: 'Farmacia Cruz Verde',
      fecha: '2026-07-15',
      tipo: null,
    });
  });
});

describe('real Chilean chain receipts -- realistic OCR noise (glare/shadow/angle)', () => {
  it('still recognizes Jumbo when header/RUT/BOLETA/TOTAL are all garbled (0/O, 5/S, 8/B confusions)', () => {
    expect(looksLikeScannedDocument(JUMBO_NOISY_TEXT)).toBe(true);
    expect(parseScannedDocument(JUMBO_NOISY_TEXT)).toEqual({
      monto: 12070,
      // The merchant dictionary catches "Jumbo" even through the 0-for-O
      // OCR confusion, via the same homogenization fuzzyKeywordMatch uses
      // for every other keyword list in this file.
      comercio: 'Jumbo',
      fecha: '2026-07-15',
      tipo: 'gasto',
    });
  });

  it('still recognizes Salcobrand when the header/RUT/BOLETA are lost entirely, via NETO/IVA/TOTAL/payment-method wording alone', () => {
    expect(looksLikeScannedDocument(SALCOBRAND_NOISY_TEXT)).toBe(true);
    const monto = extractDocumentAmount(SALCOBRAND_NOISY_TEXT);
    expect(monto).toBe(4180);
  });

  it('never picks the NETO (pre-IVA) amount over the real TOTAL, even when both are garbled', () => {
    // NET0 $3.529 must lose to T0TAL $4.180 -- proves the fuzzy-matched
    // EXCLUDED_AMOUNT_KEYWORDS check still fires on "NET0" (-> "neto").
    expect(extractDocumentAmount(SALCOBRAND_NOISY_TEXT)).not.toBe(3529);
  });
});

describe('extractDocumentAmount -- cautious "largest amount" fallback', () => {
  it('picks the largest amount on the page when no label is found at all, not the first one', () => {
    // $1.200 appears first in the text -- a naive first-match regex would
    // wrongly return that; the real total ($8.760) is both the largest AND
    // the last line here, so this also guards against an accidental
    // first-vs-last regression if the fallback logic changes later.
    expect(extractDocumentAmount(NO_LABEL_MULTI_AMOUNT_TEXT)).toBe(8760);
  });

  it('still prefers a labeled TOTAL line over a larger unlabeled number elsewhere', () => {
    const text = 'PRODUCTO CARO           $50.000\nTOTAL                   $12.070';
    expect(extractDocumentAmount(text)).toBe(12070);
  });
});

describe('parseAmount sanitization (via extractDocumentAmount) -- Chilean number formats', () => {
  it('reads a dot-grouped thousands amount (standard Chilean format)', () => {
    expect(extractDocumentAmount('TOTAL $12.070')).toBe(12070);
  });

  it('reads a comma-grouped thousands amount as a whole number, not a decimal', () => {
    // A comma followed by exactly 3 digits is a thousands separator here
    // (CLP has no meaningful cents), not "$12.99".
    expect(extractDocumentAmount('TOTAL 12,990')).toBe(12990);
  });

  it('reads a dot-thousands + comma-decimal amount correctly', () => {
    expect(extractDocumentAmount('TOTAL 12.990,50')).toBe(12990.5);
  });

  it('reads a plain ungrouped amount', () => {
    expect(extractDocumentAmount('TOTAL $990')).toBe(990);
  });
});

describe('fuzzy keyword matching -- OCR confusion tolerance', () => {
  it('recognizes "T0TAL" (0 for O)', () => {
    expect(extractDocumentAmount('T0TAL $5.000')).toBe(5000);
  });

  it('recognizes "80LETA" (8 for B) as a document signal', () => {
    expect(looksLikeScannedDocument('80LETA ELECTRONICA numero de folio 12345 total del documento $9.990')).toBe(true);
  });

  it('recognizes a misread "$" as "S" directly in front of an amount', () => {
    expect(extractDocumentAmount('TOTAL S7.280')).toBe(7280);
  });

  it('recognizes "TRAN5FERENCIA" (5 for S) as a document signal', () => {
    expect(looksLikeScannedDocument('TRAN5FERENCIA EXITOSA MONTO $20.000 PARA Juan')).toBe(true);
  });

  it('recognizes a dropped letter ("BOLET A" split oddly is out of scope, but "TOTA" for "TOTAL" within edit-distance 1)', () => {
    // "importe" (7 letters) gets 1 edit of slack; "importee" (an extra
    // letter, a real OCR duplication artifact) must still match.
    expect(extractDocumentAmount('IMPORTEE $6.500')).toBe(6500);
  });
});

describe('fuzzy keyword matching -- short-keyword safety net (no false positives)', () => {
  it('does NOT mistake "iba" (a real, common Spanish word) for "iva"', () => {
    // Short keywords (<=4 chars) get zero edit-distance slack specifically
    // to avoid this: "iva" only matches via exact/homogenized substring.
    expect(looksLikeScannedDocument('yo iba a comprar pan pero al final no compre nada de nada')).toBe(false);
  });

  it('does NOT mistake unrelated short words for "rut"/"caja"/"vale"', () => {
    expect(looksLikeScannedDocument('el ruta era largo y el cajon estaba vacio sin nada mas')).toBe(false);
  });
});

describe('extractDocumentDate -- broader formats', () => {
  it('reads a whitespace-padded date ("12 / 08 / 2026")', () => {
    expect(extractDocumentDate('Fecha: 12 / 08 / 2026')).toBe('2026-08-12');
  });

  it('reads an ISO-order date ("2026-08-12")', () => {
    expect(extractDocumentDate('Emitido 2026-08-12 10:15')).toBe('2026-08-12');
  });

  it('still does not misread a RUT as a date with the broadened patterns', () => {
    expect(extractDocumentDate('RUT: 96.756.430-3')).toBeNull();
  });
});

// ===========================================================================
// Administrative stamps ("CANCELADO"/"CEDIBLE"/"DUPLICADO"/"PAGADO"/"COPIA")
// -- modeled on two real VITEL boletas whose "CANCELADO" rubber stamp lands
// diagonally across the header, and "CEDIBLE" is printed near the barcode.
// Before this fix these were rejected outright ("No se detectó un
// comprobante..."); now the stamp word must never end up as the comercio,
// and the real total ($50.026 / $161.393, the exact amounts from those two
// receipts) must still be found.
// ===========================================================================

const VITEL_CANCELADO_TEXT = `CANCELADO
VITEL
energia
DISTRIBUIDORA TECNICA ELECTRICA VITEL S.A.
CHILOE 1189 -MATTA 1155 - G. ALDERETE 1635 - SANTIAGO
89.396.900-4
R.U.T. : 77.716.722-7
Nombre : IGD CONECTIVIDAD Y ELECTRICIDAD SPA
Giro : INSTALACIONES ELECTRICAS
Factura Afecta Electronica
Fecha: 15/05/2025
NETO 42.039
IVA 7.987
TOTAL 50.026
CUENTA CORRIENTE $ 50.026
CEDIBLE`;

const VITEL_CEDIBLE_HEADER_TEXT = `CEDIBLE
VITEL
energia
DISTRIBUIDORA TECNICA ELECTRICA VITEL S.A.
CHILOE 1189 -MATTA 1155 - G. ALDERETE 1635 - SANTIAGO
89.396.900-4
Factura Afecta Electronica
Fecha: 15/05/2025
NETO 135.624
IVA 25.769
TOTAL 161.393`;

// A common Jumbo/supermarket breakdown line ("DESCUENTOS") contains
// "descuento" as a literal substring -- which collides with the bank-
// notification promotional-copy filter (isPromotionalNotification) that
// looksLikeScannedDocument used to gate on. This receipt is otherwise
// completely legitimate.
const RECEIPT_WITH_DESCUENTOS_LINE = `JUMBO CENCOSUD
RUT: 96.756.430-3
BOLETA ELECTRONICA
DETERGENTE OMO 3KG      $6.990
SUBTOTAL               $6.990
DESCUENTOS              -$500
TOTAL                   $6.490`;

describe('extractDocumentComercio -- skips administrative stamps', () => {
  it('skips "CANCELADO" and finds the real store name (VITEL)', () => {
    expect(extractDocumentComercio(VITEL_CANCELADO_TEXT)).toBe('VITEL');
  });

  it('skips "CEDIBLE" and finds the real store name (VITEL)', () => {
    expect(extractDocumentComercio(VITEL_CEDIBLE_HEADER_TEXT)).toBe('VITEL');
  });

  it('skips "DUPLICADO"/"PAGADO"/"COPIA" individually', () => {
    // Business names here are deliberately generic (not in MERCHANT_ALIASES)
    // so this test isolates the stamp-skip logic from the merchant
    // dictionary, which is covered separately below.
    expect(extractDocumentComercio('DUPLICADO\nALMACEN LOS ROBLES\nTOTAL $5.000')).toBe('ALMACEN LOS ROBLES');
    expect(extractDocumentComercio('PAGADO\nBAZAR DON PEDRO\nTOTAL $2.500')).toBe('BAZAR DON PEDRO');
    expect(extractDocumentComercio('COPIA\nMULTITIENDAS ABC\nTOTAL $9.000')).toBe('MULTITIENDAS ABC');
  });
});

describe('extractDocumentAmount -- unaffected by administrative stamps', () => {
  it('reads $50.026 from the CANCELADO-stamped VITEL boleta', () => {
    expect(extractDocumentAmount(VITEL_CANCELADO_TEXT)).toBe(50026);
  });

  it('reads $161.393 from the CEDIBLE-stamped VITEL boleta', () => {
    expect(extractDocumentAmount(VITEL_CEDIBLE_HEADER_TEXT)).toBe(161393);
  });
});

describe('looksLikeScannedDocument -- no longer the scan flow\'s rejection gate', () => {
  // documentCapture.ts's parseAndValidate() no longer calls
  // looksLikeScannedDocument at all (see its own comment for why) --
  // extractDocumentAmount succeeding is the only thing that matters now.
  // This still confirms both stamped receipts keep a usable amount, which
  // is what actually determines whether the scan flow accepts them.
  it('a stamped receipt still has an extractable amount even when looksLikeScannedDocument would reject it', () => {
    // Neither fixture should actually be rejected (they contain "factura"),
    // but the property under test is that amount extraction alone is
    // sufficient -- independent of whatever looksLikeScannedDocument says.
    expect(extractDocumentAmount(VITEL_CANCELADO_TEXT)).not.toBeNull();
    expect(extractDocumentAmount(VITEL_CEDIBLE_HEADER_TEXT)).not.toBeNull();
  });

  it('a receipt containing "DESCUENTOS" used to be rejected as promotional bank copy -- amount extraction must not depend on that check', () => {
    // Confirms the actual bug: the promotional-copy filter fires on this
    // legitimate receipt (proving the old gate was wrong to use it here)...
    expect(looksLikeScannedDocument(RECEIPT_WITH_DESCUENTOS_LINE)).toBe(false);
    // ...yet the real total is still perfectly extractable on its own.
    expect(extractDocumentAmount(RECEIPT_WITH_DESCUENTOS_LINE)).toBe(6490);
  });
});

// ===========================================================================
// Real-world OCR transcripts (typed verbatim from the app's own "Notificación
// original" screen against two actual receipts) -- both were previously
// misread: Salcobrand returned $5 (a date fragment), Jumbo returned $4.189
// (the subtotal, not the $3.351 final total). ML Kit's line detection has
// visibly grouped every LABEL into one cluster and every NUMBER into a
// separate cluster further down the page -- the real, defining failure mode
// these fixtures guard against, not just noisy/garbled individual words.
// ===========================================================================

const SALCOBRAND_REAL_OCR_TEXT = `SALCOBRAND S.A
C.M:AYUNA MACKENNA 7110
AVDA
GIRO:
SALCOBRAND
0: FaBDO. OHTGGINS 877 SANTIAGO
VERSInRMACIA Y SUPERMERĈADO
0:0002904
V75.5 12.05.26 FXTOT
FECHA EMISION
46%
COLMAX
DIPIRONA
47% DS00mg X2
ONDANSSCUENTO SALCOBRAND
TRON (B) 8
R.U.T. :76.031.071-9
T :9063 L:405
05/06/2026
5% DESCUENTO SALCOBRAND
17% DESRM9 COMP
LOVELEMENTO SALCOBRAND
TOTAL
LIMON.0
6% DESCUENTO SALCOBRAND
TOTAL AHORRADO:
CREDITO ONLINE
05/06/26
MONTO
TOTAL
TIPO CU0TA
EMPLEAD0
ATENDIDO POR: KEVIN MANCILLA
1U
C:014
HORA : 18:42
1U
10
3907141862641
NUMERO OPERACION
CODIGO AUTORIZACION:
NUMERO UNICO
NUMERO UNICO NUO4050014906320260605184151
VENTA CREDITO
NG0NA
BOLETA ELECTRONICA Nro. 714186264
Verifique documento en www.salcobrand.cl
q9
003-
17.899
8.281
$ 11.521
19.075
SRCA). : MARIAJOSE SAN -C1iente Mi Salcobrand
Avda. VIicuna a Mackenna Oriente
La Florida
597031741181- S2PCD31741181261
18:46:12
CAJA:14
C-VI *****0016
19.075
19.075
SIN CUOTAS
9047 BOLETA: 7141886264
0405001490632026605118 4151
0010197
19630
ACEPTO PAGAR SEGUN CONTRATO CON EMISOR`;

const JUMBO_REAL_OCR_TEXT = `RUT 81201000-K
BOLETA ELECTRONICA 4 Ne 2437318631
SII SANTIAGO SUR
CENCOSUD RETAIL S.A.
AV. KENNEDY 9001 LAS CONDES-SANTIAGO
AV. EL LLANO SUBERCASEAUX 3519
SAN MIGUEL - SANTIAGO
0034000432271 MIN REESES 297 G
JUMBO OFERTAS
SUB TOTAL $
TOTAL IVA 19,00% $
NETO $
DESCUENTOS $
TOTAL $
I. DEBITO $
VUELTO $
4.189
-838
4.189
2.816
535
838
3.351
3.351
**********PUNTOS CENCOSUDx**********
PODRIAS HABER AC
INSCRIBETE V
POR ESTA
CONDICIONES EN
11
BENEFICIOS
11
i1`;

// Real Lider OCR transcript (typed from the app's own "Notificación
// original" screen): the header is the branch/address ("SUC: SANCHEZ
// FONTECILLA #8968"), and the actual "LIDER" brand mention only shows up
// deep in the footer ("actualiza tus datos en lider.cl/miclub", "Revisa tu
// boleta en: WWw.LIDER.CL", "###### LIDER ######"). The header-only fallback
// used to return the branch address as "comercio" -- this is the exact bug
// MERCHANT_ALIASES + its global (not header-only) search exists to fix.
const LIDER_REAL_OCR_TEXT = `SUC: SANCHEZ FONTECILLA #8968
LA FLORIDA SANTIAGO
RUT: 76. 134.946-5
Bol. Electroni ca: 001276593300 Caja: 0092
Fecha: 15/08/2026 Hora: 12:14:22
1801620006631 MAS GRANA
TOTAL $
MI CLUB $ 246
$ 30.750
NUM OPER: 001131079 COD AUTO
30.750
TOTAL ACUMULAD0 $ 1512 *
Revisa tus benef icioS, movimientos, y
actualiza tus datos en lider.cl/miclub
(*) Pes0s Mi Club sujetos a confirmaci on
30.750
ATENDIDO POR: User Virtual ScO92
30.750
Revisa tu boleta en: WWw.LIDER.CL
############## LIDER ##############$#
##### PRECIOS BAJOS TODOS LOS DIAS #####
COMPROBANTE DE VENTA
TARJETA DE DEBITO
COMPRA DEBITO
$ 30.750
$ 30.750
ACEPTO PAGAR SEGUN CONTRATO CON EMISOR`;

describe('extractDocumentComercio -- known Chilean chain dictionary (MERCHANT_ALIASES)', () => {
  it('finds "Lider" from a real receipt whose header is just the branch address, via the footer URL mention', () => {
    expect(extractDocumentComercio(LIDER_REAL_OCR_TEXT)).toBe('Lider');
  });

  it('the amount is unaffected by the comercio change (still $30.750, not the $1.512 loyalty-points line)', () => {
    expect(extractDocumentAmount(LIDER_REAL_OCR_TEXT)).toBe(30750);
  });

  it('recognizes every documented chain from a bare keyword mention anywhere in the text', () => {
    expect(extractDocumentComercio('ALGO\nSANTA ISABEL LAS CONDES\nTOTAL $5.000')).toBe('Santa Isabel');
    expect(extractDocumentComercio('ALGO\nCLUB UNIMARC PUNTOS\nTOTAL $5.000')).toBe('Unimarc');
    expect(extractDocumentComercio('ALGO\nVisita cruzverde.cl\nTOTAL $5.000')).toBe('Cruz Verde');
    expect(extractDocumentComercio('ALGO\nFARMACIAS AHUMADA LOCAL 4\nTOTAL $5.000')).toBe('Farmacias Ahumada');
    expect(extractDocumentComercio('ALGO\nPago con CMR Falabella\nTOTAL $5.000')).toBe('Falabella');
    expect(extractDocumentComercio('ALGO\nTIENDAS PARIS LAS CONDES\nTOTAL $5.000')).toBe('Paris');
  });

  it('does not need the brand in the header -- a global scan finds it anywhere', () => {
    const text = 'FACTURA GENERICA\nRUT: 1-9\nITEM UNO $500\nITEM DOS $500\nGracias por preferir Jumbo\nTOTAL $1.000';
    expect(extractDocumentComercio(text)).toBe('Jumbo');
  });
});

describe('extractDocumentComercio -- address/fiscal-data lines never become the fallback comercio', () => {
  it('skips "SUC:"/"AV."/"SII" lines and a branch-number marker, landing on the real name', () => {
    const text = 'SUC: LAS CONDES #123\nAV. KENNEDY 9001\nSII SANTIAGO\nALMACEN EL SOL\nTOTAL $5.000';
    expect(extractDocumentComercio(text)).toBe('ALMACEN EL SOL');
  });

  it('skips a bare branch-number marker even without an accompanying fiscal keyword', () => {
    const text = 'SANCHEZ FONTECILLA #8968\nALMACEN EL SOL\nTOTAL $5.000';
    expect(extractDocumentComercio(text)).toBe('ALMACEN EL SOL');
  });
});

describe('extractDocumentAmount -- real-world OCR transcripts (label/number fully disconnected)', () => {
  it('Salcobrand: reads $19.075, not $5 from the "05/06/26" date fragment', () => {
    expect(extractDocumentAmount(SALCOBRAND_REAL_OCR_TEXT)).toBe(19075);
  });

  it('Jumbo: reads $3.351 (the final total/T.DEBITO), not $4.189 (the subtotal/item price)', () => {
    expect(extractDocumentAmount(JUMBO_REAL_OCR_TEXT)).toBe(3351);
  });

  it('never returns a tiny amount from a bare date/quantity/percentage fragment', () => {
    const amount = extractDocumentAmount(SALCOBRAND_REAL_OCR_TEXT);
    expect(amount).not.toBeNull();
    expect(amount as number).toBeGreaterThanOrEqual(100);
  });

  it('Lider: reads $30.750, not $1.512 from "TOTAL ACUMULADO" (a Mi Club loyalty-points balance)', () => {
    expect(extractDocumentAmount(LIDER_REAL_OCR_TEXT)).toBe(30750);
  });
});

describe('extractDocumentAmount -- loyalty/points noise is excluded regardless of where it falls', () => {
  // Isolates the exact failure mode: "TOTAL ACUMULADO" fuzzily matches
  // "total" like any real total line does, so on a receipt where it happens
  // to be the LAST such match, extractDocumentAmount's own tie-break rule
  // ("the last qualifying labeled line wins") would silently prefer it over
  // the real total earlier in the text if it weren't excluded outright.
  const text = `TOTAL $ 30.750
COMPRA DEBITO $ 30.750
Revisa tus beneficios, acumulacion
TOTAL ACUMULADO $ 1.512
Puntos Mi Club sujetos a confirmacion`;

  it('ignores "TOTAL ACUMULADO" even as the very last labeled line in the document', () => {
    expect(extractDocumentAmount(text)).toBe(30750);
  });

  it('ignores every documented loyalty/points keyword individually', () => {
    expect(extractDocumentAmount('TOTAL $500\nPUNTOS CENCOSUD $9.999')).toBe(500);
    expect(extractDocumentAmount('TOTAL $500\nSALDO ACUMULADO $9.999')).toBe(500);
    expect(extractDocumentAmount('TOTAL $500\nBENEFICIOS $9.999')).toBe(500);
    expect(extractDocumentAmount('TOTAL $500\nPESOS MI CLUB $9.999')).toBe(500);
  });
});

// Real receipt (photographed, see the "Strip La Florida Spa" boleta): an
// item priced at $4.300 with a "Descuento Global $430" applied, landing on
// a final "TOTAL 3.870". Before STRONG_TOTAL_LABEL_KEYWORDS existed, the
// "Codigo  Cant.  Unitario  Valor" column header fuzzily matched a plain
// "valor" amount label and let the app grab the item's pre-discount $4.300
// instead of the real $3.870 total.
const STRIP_LA_FLORIDA_REAL_OCR_TEXT = `STRIP LA FLORIDA SPA
RUT: 77.990.637-K
GIRO: HELADERIA, CAFETERIA Y PASTELERIA
CASA MATRIZ: Rojas magallanes 3630, Depto. 5
Comuna: LA FLORIDA - Ciudad:
Boleta Electronica Nro.: 66950
Fecha Emisisn: 15-08-2026
Descripcion
Codigo          Cant.    Unitario   Valor
Frambuesas Doble C
2660            1.00 x    4.300      4.300
*Descuento: Descuento Global  $ 430
TOTAL                                 3.870
El IVA de esta boleta es $618
Timbre Electronico S.I.I.
Verifique Doc.: www.facturacion.cl/striplafloridaspa/bol`;

describe('extractDocumentAmount -- TOTAL wins over a "Valor" column header and a pre-discount item price', () => {
  it('reads $3.870 (the real TOTAL after Descuento Global), not $4.300 (the item price)', () => {
    expect(extractDocumentAmount(STRIP_LA_FLORIDA_REAL_OCR_TEXT)).toBe(3870);
  });

  it('a plain "Valor" column header alone is never mistaken for a payment-total label', () => {
    const text = 'Codigo  Cant.  Unitario  Valor\nFrambuesas  1.00 x  4.300  4.300\nTOTAL  3.870';
    expect(extractDocumentAmount(text)).toBe(3870);
  });

  it('an explicit TOTAL still wins even when it appears before a later, unrelated "monto"/"a pagar" line', () => {
    const text = 'TOTAL $3.870\nMonto disponible en cuenta: $500.000\nA pagar el proximo mes: $12.000';
    expect(extractDocumentAmount(text)).toBe(3870);
  });
});

// Real receipt (photographed, see the "Unimarc / EL PLOMO" boleta): branch
// and register metadata -- "EL PLOMO S605 711" (branch address + code) and
// "Lecel: 912 CajB: 82" (OCR-garbled "Local:"/"Caja:") -- used to pass
// ITEM_LINE_PATTERN just like a real item line and leak into "items
// detectados", from there straight into the Notas prefill.
describe('extractDocumentItems -- branch/register/address metadata never becomes an item', () => {
  const text = `UNIMARC
EL PLOMO S605 711
Lecel: 912 CajB: 82
7802225640558 GALLETA RIGOCHOC 1
7802225640770 GALLETA BANDEJA 80
TOTAL $ 30.752`;

  it('excludes the branch-code and Lecel/CajB lines', () => {
    const items = extractDocumentItems(text);
    expect(items.some((item) => item.includes('S605'))).toBe(false);
    expect(items.some((item) => /lecel|cajb/i.test(item))).toBe(false);
  });

  it('still keeps the real item lines', () => {
    const items = extractDocumentItems(text);
    expect(items.some((item) => item.includes('GALLETA RIGOCHOC'))).toBe(true);
    expect(items.some((item) => item.includes('GALLETA BANDEJA'))).toBe(true);
  });

  it('a bare "Local:"/"Caja:" (no OCR misread) is also excluded', () => {
    const items = extractDocumentItems('Local: 912\nCaja: 82\nGALLETA RIGOCHOC 1.990');
    expect(items).toEqual(['GALLETA RIGOCHOC 1.990']);
  });

  it('strips a leading EAN/UPC barcode from an item line instead of dropping the whole line', () => {
    const items = extractDocumentItems('7802225640558 GALLETA RIGOCHOC 1');
    expect(items).toEqual(['GALLETA RIGOCHOC 1']);
  });

  it('never reformats an ordinary item line that has no barcode to strip', () => {
    const items = extractDocumentItems('PAN                 $1.500');
    expect(items).toEqual(['PAN                 $1.500']);
  });
});

describe('extractDocumentAmount -- explicit "TOTAL" variants win over item/column noise', () => {
  it('"MONTO TOTAL" and "VALOR TOTAL" are treated as strong total labels', () => {
    expect(extractDocumentAmount('Valor\n4.300\nMONTO TOTAL $3.870')).toBe(3870);
    expect(extractDocumentAmount('Valor\n4.300\nVALOR TOTAL $3.870')).toBe(3870);
  });

  it('"TOTAL CLP" is treated as a strong total label', () => {
    expect(extractDocumentAmount('Item $1.000\nTOTAL CLP 3.870')).toBe(3870);
  });
});

describe('extractDocumentAmount -- false-positive fields never become the amount', () => {
  it('ignores a phone number line', () => {
    expect(extractDocumentAmount('TOTAL $5.000\nTelefono: 22345678')).toBe(5000);
  });

  it('ignores a product/SKU/PLU code line', () => {
    expect(extractDocumentAmount('TOTAL $5.000\nCodigo: 998877\nPLU 12345\nSKU: 445566')).toBe(5000);
  });

  it('ignores a boleta folio number', () => {
    expect(extractDocumentAmount('Boleta N: 66950\nTOTAL $5.000')).toBe(5000);
  });

  it('never picks a bare EAN/UPC barcode as the amount when no real total exists', () => {
    const amount = extractDocumentAmount('7802225640558 GALLETA RIGOCHOC\n8801234567890 OTRO PRODUCTO');
    expect(amount).toBeNull();
  });

  it('caps the "largest amount" fallback at a plausible personal-purchase ceiling', () => {
    // No labeled total anywhere -- the fallback must never crown an
    // implausibly huge number (e.g. a misread long digit run) as the total.
    const amount = extractDocumentAmount('Referencia 123456789012\nCompra varios $4.500');
    expect(amount).toBe(4500);
  });
});

describe('extractDocumentComercio -- skips a "CASA MATRIZ" address line too', () => {
  it('falls through to the real business name below it', () => {
    const text = 'CASA MATRIZ: Rojas magallanes 3630, Depto. 5\nSTRIP LA FLORIDA SPA\nTOTAL $3.870';
    expect(extractDocumentComercio(text)).toBe('STRIP LA FLORIDA SPA');
  });
});

// Real receipt (photographed twice -- a clean top-down shot and a second,
// angled shot on a dark wood table), transcribed in full. The actual
// charged total is $7.470 (restated 4 times: "TOTAL $7470" right after the
// item list, "TARJETA $7470" in the payment breakdown, then "MONTO $7.470"
// and "TOTAL $7.470" again on the card-payment slip at the very bottom).
// $30.752 -- what an earlier version of this parser returned -- is
// "TOTAL AHORRO ULTIMOS 12 MESES", a 12-month loyalty-savings figure from a
// completely separate footer block, not this purchase's total at all.
const UNIMARC_REAL_RECEIPT_TEXT = `UNIMARC ROJAS MAGALLANES
R.U.T.81.537.600-5
RENDIC HERMANOS S.A.
CASA MATRIZ: CERRO EL PLOMO 5680 7-11
LAS CONDES-SANTIAGO
SUCURSAL: ROJAS MAGALLANES # 3638
FECHA EMISION: 15/08/2026 HORA: 17:10
LOCAL: 912 CAJA: 82 BOLETA ELECTRONICA: 2393912225
CODIGO DESC.ARTICULO VALOR
70847009511 BEB ENERGETICA MONSTER 473 CC $1890
7802215512377 GALLETA FRAC COSTA $800
7801620001223 KEM PINA DESECHABLE 3 LT $3190
Club Unimarc CCU $-700
7802225640558 GALLETA RIGOCHOC 1 $1350
Club Unimarc RIGO $-350
7802225640770 GALLETA BANDEJA BO $1590
Club Unimarc BON $-300
TOTAL $7470
Desglose del Total:
Neto $6277
IVA $1193
DETALLE DE PAGOS
TARJETA $7470
TOTAL PAGOS
AHORRO UNIMARC
Club Unimarc $-1350
TOTAL AHORRO HOY $-1350
TOTAL AHORRO ULTIMOS 12 MESES:
$30752
TARJETA DE DEBITO
MONTO $ 7.470
TOTAL $ 7.470
ACEPTO PAGAR SEGUN CONTRATO CON EMISOR`;

describe('extractDocumentAmount -- real Unimarc receipt: TOTAL AHORRO 12 MESES is never the total', () => {
  it('reads $7.470 (the real charged total), not $30.752 (12-month loyalty savings)', () => {
    expect(extractDocumentAmount(UNIMARC_REAL_RECEIPT_TEXT)).toBe(7470);
  });

  it('extractDocumentComercio still correctly finds Unimarc on the same receipt', () => {
    expect(extractDocumentComercio(UNIMARC_REAL_RECEIPT_TEXT)).toBe('Unimarc');
  });

  it('ignores every AHORRO-block variant individually', () => {
    expect(extractDocumentAmount('TOTAL $7.470\nTOTAL AHORRO HOY -$1.350')).toBe(7470);
    expect(extractDocumentAmount('TOTAL $7.470\nAHORRO UNIMARC $9.999')).toBe(7470);
    expect(extractDocumentAmount('TOTAL $7.470\nPUNTOS UNIMARC $9.999')).toBe(7470);
    expect(extractDocumentAmount('TOTAL $7.470\nClub Unimarc CCU -$700')).toBe(7470);
  });
});

// Real receipt (Central Parking System, Mall Plaza Vespucio) -- OCR reads
// the header "Recibo" with a stray inserted space as "Reci bo", which used
// to slip past the comercio header-skip check entirely and get saved as
// the movement's name.
const PARKING_REAL_RECEIPT_TEXT = `Recibo
Direccion
Central Parking System S.A.
Adm. de Estacionamientos
La Concepcion #266
Santiago
Providencia
RUT No. 77248210-8
Fecha 05-05-2026 18:32
Recibo 700449672
Nro. Boleta: 180573293
Plaza Vespucio
Cajero Autom. 1 Paris
Nro. De Caja:4
Ticket 614019196
Matricula RKYX96
PVE Shortterm Parking
Entrada 1 Prosport
Desde 05-05-2026 18:13
Hasta 05-05-2026 18:32
Estadia 00:20
Tarifa 450 CLP
Pagado 450 CLP
KLAP
TARJETA DE DEBITO
PARKING MALL PLAZA VESPUCIO
ESTACIONAMIENTO DE AUTOMOVILES
TOTAL: $450
ACEPTO PAGAR SEGUN CONTRATO DEL EMISOR`;

describe('extractDocumentComercio -- "Recibo" is never the comercio, even OCR-garbled', () => {
  it('finds the actual venue name ("PARKING MALL PLAZA VESPUCIO"), not the generic operator', () => {
    expect(extractDocumentComercio(PARKING_REAL_RECEIPT_TEXT)).toBe('PARKING MALL PLAZA VESPUCIO');
  });

  it('falls back to the operator name (merchant dictionary) when no clean venue line exists', () => {
    const text = 'Recibo\nCentral Parking System S.A.\nAdm. de Estacionamientos\nTOTAL $450';
    expect(extractDocumentComercio(text)).toBe('Central Parking System');
  });

  it('a bare "Recibo" header line is skipped even without the merchant dictionary', () => {
    const text = 'Recibo\nDireccion\nALMACEN EL SOL\nTOTAL $500';
    expect(extractDocumentComercio(text)).toBe('ALMACEN EL SOL');
  });

  it('an OCR-garbled "Reci bo" (stray inserted space) is also skipped', () => {
    const text = 'Reci bo\nALMACEN EL SOL\nTOTAL $500';
    expect(extractDocumentComercio(text)).toBe('ALMACEN EL SOL');
  });

  it('the real charged amount ($450) is unaffected', () => {
    expect(extractDocumentAmount(PARKING_REAL_RECEIPT_TEXT)).toBe(450);
  });
});

// Real receipt (photographed, Central Parking System / Mall Plaza Vespucio),
// typed verbatim from the app's own "Notificación original" screen -- a
// second, more garbled real capture than PARKING_REAL_RECEIPT_TEXT above.
// "Central Parking System" itself got OCR'd as "Central Parking Systen S. A."
// (a dropped "m", plus the "S. A." legal suffix spaced out) -- "systen"
// never exactly equals "system" in PARKING_GENERIC_FOLLOWERS, so before the
// legal-entity-suffix check existed, this header line (appearing near the
// TOP of the document) won outright over "PARKING MALL PLAZA VESPUCIO"
// (appearing much further down), the exact bug reported on a real device.
const PARKING_TYPO_RECEIPT_TEXT = `Reci bo
Direcoi ón
Central Parking Systen S. A.
Adn. de Estao ionam ientos
La Concepción #266
Sant iago
Providencia
RUT No.
Fecha
Reoibo
Nro. Boleta:
Plaza Vespur io
Cajero Autom. 1 Par is
Nro. De Caja:4
Ticket
Matrícula
PVE Shorttern Parking
Entrada 1 Prosport
Desde
Hasta
Estadia
Tar ifa
Pagado
MASTERCARD
MONTO NETO:
IVA 19%:
TOTAL:
KLAP
05-05-2026 18:32
700449672
180573293
TARJETA DE DEBITO
FECHA
05/05/2026
FECHA CONTABLE:
NUMERO DE TARJETA:
CODIGO KLAP:
77248210-8
05-05-2026 18:13
05-05-2026 18:32
PARKING MALL PLAZA VESPUCIO
ESTACIONAMIENTO DE AUTOMOVILES
77248210-8
AV VICUNA MACKENNA ORIENTE 7110, LA
FLORIDA
Santiago
VALIDO COMO BOLETA
DUPLICADO
HORA
18:32:49
CODIGO DE AUTORIZACION:
FHO19 36
KKYX96`;

describe('extractDocumentComercio -- a legal-entity suffix ("S.A.") never outranks the real venue name', () => {
  it('skips "Central Parking Systen S. A." (OCR-dropped "m", still ends in "S. A.") and finds "PARKING MALL PLAZA VESPUCIO"', () => {
    expect(extractDocumentComercio(PARKING_TYPO_RECEIPT_TEXT)).toBe('PARKING MALL PLAZA VESPUCIO');
  });
});

describe('extractDocumentComercio -- mall/parking merchant dictionary', () => {
  it('recognizes malls and parking operators from a bare mention', () => {
    expect(extractDocumentComercio('ALGO\nAutoPark Ltda\nTOTAL $1.000')).toBe('AutoPark');
    expect(extractDocumentComercio('ALGO\nCostanera Center Parking\nTOTAL $1.000')).toBe('Costanera Center');
    expect(extractDocumentComercio('ALGO\nParque Arauco S.A.\nTOTAL $1.000')).toBe('Parque Arauco');
    expect(extractDocumentComercio('ALGO\nMall Florida Center\nTOTAL $1.000')).toBe('Mall Florida Center');
    expect(extractDocumentComercio('ALGO\nMalls de Chile S.A.\nTOTAL $1.000')).toBe('Malls de Chile');
  });
});

// Real-device OCR failure mode reported directly by the user: on a receipt
// that repeats its real total under several different labels, a SINGLE
// garbled label/number pairing (an item price landing next to a
// fuzzily-"total"-shaped stray word, most likely from ML Kit's line
// clustering regrouping labels and numbers separately on a skewed photo --
// see findConsecutiveDuplicateAmount's own comment) used to silently win
// outright just for being the LAST labeled match encountered. Picking the
// value corroborated by the most independent labeled lines instead is
// robust to exactly one such misread, as long as the real total survives
// OCR at least twice elsewhere -- which a real boleta's own repetition
// (subtotal block, payment breakdown, card slip) almost always provides.
// Real receipt (photographed, Strip La Florida Spa), typed verbatim from the
// app's own "Notificación original"/"Ver texto OCR crudo" screen -- far more
// garbled than STRIP_LA_FLORIDA_REAL_OCR_TEXT above (which was a clean
// synthetic reconstruction, not an actual device capture). Two real,
// distinct bugs live in this one transcript:
//   1. "GIRO: HELADERIA..." OCR'd as "IRO: NELADERIA..." (dropped "G" AND
//      "H") used to be the first header line HEADER_SKIP_KEYWORDS' 4-char
//      'giro' entry couldn't catch (zero Levenshtein slack), so it became
//      the wrongly-returned comercio outright.
//   2. ML Kit's line detection scrambled the "Unitario | Valor" column
//      layout apart from the "TOTAL" row entirely -- "TOTAL" (itself OCR'd
//      "T01AL") never lands within one line of any number, so every
//      fallback tier grabs the item's pre-discount $4.300 (repeated twice
//      as "Unitario"/"Valor" for a single-quantity item) instead of the
//      real $3.870 post-"Descuento Global $430" total, which OCR further
//      corrupted into an unparseable "3.8710" token that no amount pattern
//      can even match on its own.
// Note: the actual store header line ("STRIP LA FLORIDA SPA") was not
// legible to OCR at all in this capture (the transcript starts at "RUT:")
// -- so the CORRECT comercio outcome here is null ("Comercio no
// detectado"), not a guess. That's the honest result once every
// address/giro/fiscal line in the header window is correctly excluded.
const STRIP_LA_FLORIDA_GARBLED_REAL_OCR_TEXT = `RUT: 77 990 637-K
IRO: NELADERIA, CAFETERIA Y PASTELERIA
CASA NATRIZ: Rojes nagallanes 3638, Depto. 5
Conuna: LA FLORIDA - Ciudad:
Boleta Electronica Nro.: 66950
Fecha Enisisn: 15-08-2026
DEscripcion
Codigo
Franbuesas Doble C
2660
Cant.
1,00 x
<Descuento: Descuento G1obal s 430
T01AL
Unitario
4.300
E1 IVA de esta baleta es $618
TiotsBe62814
Valor
4.300
3.8710
Verifique Doc.: www.facturacion.cl/striplafloridaspa/bol`;

describe('extractDocumentAmount -- recovers the post-discount total when "TOTAL" never pairs with any number', () => {
  it('reads $3.870 (item price $4.300 minus the $430 Descuento Global), not $4.300', () => {
    expect(extractDocumentAmount(STRIP_LA_FLORIDA_GARBLED_REAL_OCR_TEXT)).toBe(3870);
  });
});

describe('extractDocumentComercio -- a dropped "G" ("IRO:" for "GIRO:") is skipped, never becomes the comercio', () => {
  it('never returns "IRO: NELADERIA, CAFETERIA Y PASTELERIA"', () => {
    expect(extractDocumentComercio(STRIP_LA_FLORIDA_GARBLED_REAL_OCR_TEXT)).not.toBe(
      'IRO: NELADERIA, CAFETERIA Y PASTELERIA'
    );
  });

  it('falls through to null when no legible business-name line exists at all, rather than guessing', () => {
    expect(extractDocumentComercio(STRIP_LA_FLORIDA_GARBLED_REAL_OCR_TEXT)).toBeNull();
  });

  it('a clean "GIRO:" line (no OCR corruption) is skipped the same way, falling through to the real header above it', () => {
    const text = 'STRIP LA FLORIDA SPA\nGIRO: HELADERIA, CAFETERIA Y PASTELERIA\nTOTAL $3.870';
    expect(extractDocumentComercio(text)).toBe('STRIP LA FLORIDA SPA');
  });
});

describe('extractDocumentAmount -- picks the most-corroborated total, not just the last labeled line', () => {
  it('Lider-style: total repeated 3x beats a single stray item-price mislabel', () => {
    const text = `78043207827844 VINO JT 128 20.1 $ 4.090
TOTAL AFECTO $ 25.840
TOTAL IVA(19.0)$ 4.910
TOTAL $ 30.750
TAR DEB/PREP
TOTAL $ 30.750
NUM OPER 001131079
TOTAL $ 30.750`;
    expect(extractDocumentAmount(text)).toBe(30750);
  });

  it('Unimarc-style: total repeated 2x beats a single stray item-price mislabel', () => {
    const text = `70847009511 BEB ENERGETICA MONSTER 473 CC $1890
TOTAL $7470
MONTO $ 7.470
TOTAL $ 7.470`;
    expect(extractDocumentAmount(text)).toBe(7470);
  });

  it('a single unrepeated labeled amount still wins (no corroboration needed when unambiguous)', () => {
    expect(extractDocumentAmount('TOTAL $3.870')).toBe(3870);
  });

  it('an exact tie between two different amounts (same tier) still falls back to the last one seen', () => {
    expect(extractDocumentAmount('TOTAL $1.000\nTOTAL A PAGAR $2.000')).toBe(2000);
  });
});

// Real receipt (a second, more garbled Unimarc capture than
// UNIMARC_REAL_RECEIPT_TEXT above), typed verbatim from the app's own "Ver
// texto OCR crudo" screen. The real total is $7.470 -- the app returned
// $1.350. Tracing this by hand: "TOTAL AHORRO HOY" itself was ALREADY
// excluded outright (EXCLUDED_AMOUNT_KEYWORDS' own 'ahorro' entry), so it was
// never the direct culprit despite how it looks. The actual bug: ML Kit's
// line detection separated "TARJETA DE DEBITO" (a legitimate Tier-1b
// payment-method label) from its own row, landing it right next to an
// unrelated "-$1350" a few lines down -- a negative Club Unimarc discount
// adjustment. AMOUNT_PATTERN never captured that leading "-" at all, so
// "-$1350" read as a perfectly valid positive $1.350 candidate. Fixed via
// isNegativeAmountMatch, not by adding another already-redundant
// "ahorro"/"descuento" label exclusion.
const UNIMARC_GARBLED_REAL_OCR_TEXT = `7.470
7.470
7 /00
ACEPTO PABAR SEGUN CONTRATO CON ENISOR
0000091 2822026081517110611
COD AUTO 071004
H3PCF29868573703
TARJETA DE DEBITO
-$1350
-S1350
$7470
$7470
$1193
$6277
$7470
$-300
$1590
$-350
S1350
$-700
$3190
S800
derachas n0 casueid ast letteLer 8,496)
$1890
VALOR
211519824
17:11:20
NERO UNIDO
NUH OPER 001826073
$30752
TOTAL AHORRO ULTINOS 12 MESES:
AHORRO UNINARC
************3581
15/08/26
597029868573 - 4.0
3638
TOTAL
HONTO
TOTAL AHORRO HOY
CTub Uainarc
Total articulos vendidos: 5
Total itens: 5
8EB ENERGETICA MON
CANT./UNTDAD/PRECIO UNITARIO
DESC.ARTICULO
DETALLE DE PAGOS
TOTAL PAGOS
TARJETA
Desglose dal Total:
Club Uninarc BON
7802225640770 GALLETA BANDEJA 80
Club Uninarc RIGO
7802225640558 GALLETA RIGOCHOC 1
Club Uninarc CCU
LAS CONDES-SANT IAGO
E3LT
7801620001223 KEM PINA DESECHABL
78022155 12377 GALLETA FRAC COSTA
IVA
Neto
STER 473 CC, ENERGY
70847009511
REMD IC HERMANOS $.A.
R.U.T.81.537.600-5
Unisarc Rojes Magal lenes
TOTAL
HIPERNERCADOS
Boleta E1ectron ica: 2393912225
Local: 912 Caja: 82
Fecha Enision: 15/08/2026 Hota: 17:10 Trans: 165847
Sucursal: Rojas Magallenes
cOD TGO
Giro: GRANDES ESTABLEC IHIENTOS (VENTA DE AL IHENTOS),
Cese Natriz: CERRO EL PLONO 5680 7-11`;

describe('extractDocumentAmount -- a negative-signed discount line never outranks the real total', () => {
  it('reads $7.470 (corroborated 4x as a bare positive amount), not $1.350 (a "-$1350" discount adjustment)', () => {
    expect(extractDocumentAmount(UNIMARC_GARBLED_REAL_OCR_TEXT)).toBe(7470);
  });

  it('a negative amount is never picked even as a last-resort fallback', () => {
    expect(extractDocumentAmount('Club Unimarc CCU -$700\nAlgo mas -$500')).toBeNull();
  });

  it('a positive amount on the same line as a negative one is still found', () => {
    expect(extractDocumentAmount('TOTAL $5.000\nDescuento -$500')).toBe(5000);
  });
});

// Real receipt (a THIRD, differently-garbled Unimarc capture), typed
// verbatim from the app's own "Ver texto OCR crudo" screen -- this specific
// scan returned $747, not $1.350 like the other Unimarc capture above. Root
// cause: AMOUNT_WITH_SIGN's "grouped" alternative used to accept ZERO
// separator repetitions (`*`), so for a bare "$7470" (OCR dropped the "."
// thousands separator entirely -- extremely common) the bounded `\d{1,3}`
// greedily grabbed only its first 3 digits ("747") and the regex was
// perfectly satisfied with that short match, never trying the ungrouped
// `\d+` alternative that would have captured all 4 digits. Fixed by
// requiring at least one real separator+3-digit group (`+`) before that
// alternative can match at all, same shape AMOUNT_GROUPED already used
// correctly -- see AMOUNT_PATTERN's own comment for the full explanation.
const UNIMARC_TRUNCATED_AMOUNT_REAL_OCR_TEXT = `Uninarc Rojes Magal lenes
R.U.T.81.597.600-5
RENDIC HERMGOS S.A.
Case Natriz: CERRO EL PLONO 56A0 7-11
LAS CONDES-SANT IAGO
Biro: GRANOES ESTABLECIHIENTOS (VENTA DE ALIMENT OS).
HIPERMERCADOS
Sucursal: Rojas Magallanes # 3638
Fecha Enision: 15/08/2026 Hora: 17:10 Trans: 165847
Local: 912 Caja: 82
Boleta Electronica 2393912225
COD IGO
70847009511
BEB ENERGETICA MON
STER 473 CC, ENERGY
7802215512377 GALLETA FRAC COSTA
7801620001223 KEM PINA DESECHABL
E 3 LT
7802225640558 GALLETA RIGOCHOC 1
TOTAL
7802225640770 GALLETA BANDEJA 80
Neto
IVA
Desglose del Total:
TARJETA
DESC ARTICULO
CANT./UNIDAD/PRECIO UNITARIO
TOTAL PAGOS
Club Uninarc CCU
DETALLE DE PAGOS
Club Uninarc RIGO
CTub Uninarc BON
Total articulos vendidos: 5
MONTO
Club Uninarc
TOTAL AHORRO HOY
TOTAL
HUWERO UNICO
597029868573 - 4.0
15/08/26
************3581
AHORRO UNIMARC
TOTAL AHORRO ULTINOS 12 NESES:
$30752
NUH OPER 001826073
Tinbre electrHa sll
17:11:20
ACEPTO PAGAR SEGUN CONTRATO CON EMISOR
Nro CAJERO/A: 0581
UALOR
s1890
211519320
S800
$3190
$-700
$1350
$-350
$1590
$-300
$7470
S6277
s1193
$7470
$7470
-s1350
-$1350
TARJETA DE DEBITO
H3PCF29868573703
1 700
7.470
7.470
COD AUTO 071004
DO0009128220608151110611
Verifique Dacunento: uu.sii.cl y /0 Wuw.uninarc.cl`;

describe('extractDocumentAmount -- an ungrouped 4-digit amount after "$" is never truncated', () => {
  it('reads $7.470 in full, not $747 (the old AMOUNT_WITH_SIGN truncation bug)', () => {
    expect(extractDocumentAmount(UNIMARC_TRUNCATED_AMOUNT_REAL_OCR_TEXT)).toBe(7470);
  });

  it('a bare "$7470" (no thousands separator) reads as 7470 on its own, isolated from the rest of the receipt', () => {
    expect(extractDocumentAmount('TOTAL\n$7470')).toBe(7470);
  });

  it('a bare "7470 CLP" (no separator) reads as 7470, not 470', () => {
    expect(extractDocumentAmount('Recibiste 7470 CLP')).toBe(7470);
  });

  it('still reads a genuinely grouped amount correctly alongside an ungrouped one', () => {
    expect(extractDocumentAmount('TOTAL $7.470')).toBe(7470);
  });
});
