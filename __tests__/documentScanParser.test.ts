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
