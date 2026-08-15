import { parseBankNotification, isPromotionalNotification, isRealTransactionNotification } from '../lib/parsers/bankNotificationParser';

describe('parseBankNotification', () => {
  it('parses a Banco de Chile compra notification', () => {
    expect(
      parseBankNotification(
        'Banco de Chile: Compra por $12.990 en STARBUCKS CHILE, tarjeta terminada en 4321'
      )
    ).toEqual({ monto: 12990, comercio: 'STARBUCKS CHILE', tipo: 'gasto' });
  });

  it('parses a Santander compra aprobada notification with a trailing date', () => {
    expect(
      parseBankNotification(
        'Santander: Compra aprobada por $15.990 en FARMACIAS AHUMADA el 05-08-2026'
      )
    ).toEqual({ monto: 15990, comercio: 'FARMACIAS AHUMADA', tipo: 'gasto' });
  });

  it('parses a BCI transferencia recibida notification', () => {
    expect(
      parseBankNotification('BCI: Recibiste una transferencia por $50.000 de JUAN PEREZ')
    ).toEqual({ monto: 50000, comercio: 'JUAN PEREZ', tipo: 'ingreso' });
  });

  it('parses a Tenpo compra notification', () => {
    expect(parseBankNotification('Tenpo: Pagaste $8.500 en UBER TRIPS')).toEqual({
      monto: 8500,
      comercio: 'UBER TRIPS',
      tipo: 'gasto',
    });
  });

  it('picks the sender, not the amount, when two "de" occur (Mercado Pago)', () => {
    expect(
      parseBankNotification('Mercado Pago: Recibiste un pago de $25.000 de MARIA GONZALEZ')
    ).toEqual({ monto: 25000, comercio: 'MARIA GONZALEZ', tipo: 'ingreso' });
  });

  it('parses a Banco Falabella compra notification', () => {
    expect(
      parseBankNotification('Banco Falabella: Compra por $34.990 en FALABELLA RETAIL')
    ).toEqual({ monto: 34990, comercio: 'FALABELLA RETAIL', tipo: 'gasto' });
  });

  it('parses a Mach transferencia enviada notification', () => {
    expect(parseBankNotification('Mach: Enviaste $10.000 a PEDRO SOTO')).toEqual({
      monto: 10000,
      comercio: 'PEDRO SOTO',
      tipo: 'gasto',
    });
  });

  it('parses a Mach transferencia recibida notification', () => {
    expect(parseBankNotification('Mach: Recibiste $20.000 de ANA TORRES')).toEqual({
      monto: 20000,
      comercio: 'ANA TORRES',
      tipo: 'ingreso',
    });
  });

  it('parses a BancoEstado transferencia recibida notification', () => {
    expect(
      parseBankNotification('BancoEstado: Transferencia recibida por $100.000 de EMPRESA SPA')
    ).toEqual({ monto: 100000, comercio: 'EMPRESA SPA', tipo: 'ingreso' });
  });

  it('parses a generic compra notification with the merchant before the amount', () => {
    expect(parseBankNotification('Compra en COMERCIAL SPA por $7.990')).toEqual({
      monto: 7990,
      comercio: 'COMERCIAL SPA',
      tipo: 'gasto',
    });
  });

  it('parses an amount written with a trailing CLP instead of a $ sign', () => {
    expect(parseBankNotification('Cargo por 12.990 CLP en NETFLIX')).toEqual({
      monto: 12990,
      comercio: 'NETFLIX',
      tipo: 'gasto',
    });
  });

  it('parses a grouped amount with no $ sign and no CLP suffix', () => {
    expect(parseBankNotification('Compra aprobada 45.500 en JUMBO')).toEqual({
      monto: 45500,
      comercio: 'JUMBO',
      tipo: 'gasto',
    });
  });

  it('parses a large amount with multiple thousand separators', () => {
    expect(parseBankNotification('Santander: Compra por $1.234.567 en TIENDA PARIS')).toEqual({
      monto: 1234567,
      comercio: 'TIENDA PARIS',
      tipo: 'gasto',
    });
  });

  it('extracts the amount and tipo but returns null comercio when nothing capitalized follows en/de/a', () => {
    expect(
      parseBankNotification('Giro en efectivo por $50.000 en cajero automático')
    ).toEqual({ monto: 50000, comercio: null, tipo: 'gasto' });
  });

  it('returns all nulls for text with no amount, merchant or type keywords', () => {
    expect(parseBankNotification('Recordatorio: revisa tu estado de cuenta')).toEqual({
      monto: null,
      comercio: null,
      tipo: null,
    });
  });
});

describe('isPromotionalNotification', () => {
  it('flags a "necesitas efectivo" cash-advance ad', () => {
    expect(isPromotionalNotification('¿Necesitas efectivo? Solicita tu crédito preaprobado hoy mismo')).toBe(true);
  });

  it('flags a card-upsell promotion, case- and accent-insensitively', () => {
    expect(isPromotionalNotification('PROMOCIÓN: Sube tu cupo y aprovecha nuestra tasa preferencial')).toBe(true);
  });

  it('does not flag a real compra notification', () => {
    expect(isPromotionalNotification('Banco de Chile: Compra por $12.990 en STARBUCKS CHILE')).toBe(false);
  });
});

describe('isRealTransactionNotification', () => {
  it('accepts a real compra notification with an extractable amount', () => {
    expect(isRealTransactionNotification('Compra por $12.990 en STARBUCKS CHILE')).toBe(true);
  });

  it('rejects a promotional message even when it contains a number', () => {
    expect(
      isRealTransactionNotification('Pide tu crédito preaprobado de hasta $2.000.000 y recíbelo hoy')
    ).toBe(false);
  });

  it('rejects a message with no extractable amount', () => {
    expect(isRealTransactionNotification('Recordatorio: revisa tu estado de cuenta')).toBe(false);
  });
});
