import { matchBrand } from '../lib/brands/brandCatalog';

describe('matchBrand', () => {
  it('returns null for blank/missing input', () => {
    expect(matchBrand(null)).toBeNull();
    expect(matchBrand(undefined)).toBeNull();
    expect(matchBrand('')).toBeNull();
    expect(matchBrand('   ')).toBeNull();
  });

  it('returns null when nothing in the catalog matches', () => {
    expect(matchBrand('Almacen El Sol')).toBeNull();
  });

  it('recognizes every brand explicitly requested, from a clean exact mention', () => {
    expect(matchBrand('Lider')?.id).toBe('lider');
    expect(matchBrand('Unimarc')?.id).toBe('unimarc');
    expect(matchBrand('Tottus')?.id).toBe('tottus');
    expect(matchBrand('Jumbo')?.id).toBe('jumbo');
    expect(matchBrand('Mallplaza Vespucio')?.id).toBe('mallplaza');
    expect(matchBrand('Integramedica')?.id).toBe('integramedica');
    expect(matchBrand('Mercado Pago')?.id).toBe('mercado-pago');
    expect(matchBrand('Servipag')?.id).toBe('servipag');
    expect(matchBrand('Banco Falabella')?.id).toBe('banco-falabella');
    expect(matchBrand('Banco de Chile')?.id).toBe('banco-chile');
    expect(matchBrand('BancoEstado')?.id).toBe('banco-estado');
    expect(matchBrand('Santander')?.id).toBe('santander');
  });

  it('tolerates OCR noise via the same fuzzy matching the parser uses ("uninarc" for "unimarc")', () => {
    expect(matchBrand('UNINARC')?.id).toBe('unimarc');
  });

  it('matches "mercadopago" written as one word, same as the real notification/receipt wording', () => {
    expect(matchBrand('Mercadopago Botilleria Las Condes')?.id).toBe('mercado-pago');
  });

  it('a specific "Banco Falabella" mention wins over the broader retail "Falabella" entry', () => {
    expect(matchBrand('Banco Falabella')?.id).toBe('banco-falabella');
  });

  it('bare retail "Falabella"/"CMR Falabella" still matches the retail entry', () => {
    expect(matchBrand('Falabella')?.id).toBe('falabella');
    expect(matchBrand('CMR Falabella')?.id).toBe('falabella');
  });

  it('matches a brand mentioned anywhere within a longer comercio string, not just an exact match', () => {
    expect(matchBrand('PARKING MALL PLAZA VESPUCIO')?.id).toBe('mallplaza');
    expect(matchBrand('SUC SANCHEZ FONTECILLA LIDER')?.id).toBe('lider');
  });

  it('every catalog entry exposes either a text mark or an Ionicons glyph, never neither', () => {
    for (const name of ['Lider', 'Unimarc', 'Mercado Pago', 'Banco de Chile', 'Servipag']) {
      const match = matchBrand(name);
      expect(match).not.toBeNull();
      expect(!!match!.mark || !!match!.icon).toBe(true);
      expect(match!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('recognizes every brand added from the real downloaded logo batch', () => {
    expect(matchBrand('Copec')?.id).toBe('copec');
    expect(matchBrand('Petrobras')?.id).toBe('petrobras');
    expect(matchBrand('Uber')?.id).toBe('uber');
    expect(matchBrand('Uber Eats')?.id).toBe('uber-eats');
    expect(matchBrand('Cabify')?.id).toBe('cabify');
    expect(matchBrand('DiDi')?.id).toBe('didi');
    expect(matchBrand('PedidosYa')?.id).toBe('pedidosya');
    expect(matchBrand('Cruz Verde')?.id).toBe('cruz-verde');
    expect(matchBrand('Salcobrand')?.id).toBe('salcobrand');
    expect(matchBrand('Farmacias Ahumada')?.id).toBe('farmacias-ahumada');
    expect(matchBrand('Farmacias Dr. Simi')?.id).toBe('dr-simi');
    expect(matchBrand('Bupa Chile')?.id).toBe('bupa');
    expect(matchBrand('ACHS')?.id).toBe('achs');
    expect(matchBrand('Red Salud')?.id).toBe('red-salud');
    expect(matchBrand('Ripley')?.id).toBe('ripley');
    expect(matchBrand('La Polar')?.id).toBe('la-polar');
    expect(matchBrand('Tricot')?.id).toBe('tricot');
    expect(matchBrand('Sodimac')?.id).toBe('sodimac');
    expect(matchBrand('Easy')?.id).toBe('easy');
    expect(matchBrand('H&M')?.id).toBe('hm');
    expect(matchBrand('Zara')?.id).toBe('zara');
    expect(matchBrand('Alvi')?.id).toBe('alvi');
    expect(matchBrand('Bci')?.id).toBe('bci');
    expect(matchBrand('Scotiabank')?.id).toBe('scotiabank');
    expect(matchBrand('Itau')?.id).toBe('itau');
    expect(matchBrand('Tenpo')?.id).toBe('tenpo');
    expect(matchBrand('Mach')?.id).toBe('mach');
    expect(matchBrand('Transbank')?.id).toBe('transbank');
    expect(matchBrand('Sencillito')?.id).toBe('sencillito');
    expect(matchBrand('Entel')?.id).toBe('entel');
    expect(matchBrand('Movistar')?.id).toBe('movistar');
    expect(matchBrand('WOM')?.id).toBe('wom');
    expect(matchBrand('VTR')?.id).toBe('vtr');
    expect(matchBrand('Enel')?.id).toBe('enel');
    expect(matchBrand('CGE')?.id).toBe('cge');
    expect(matchBrand('Aguas Andinas')?.id).toBe('aguas-andinas');
    expect(matchBrand('Autopista Central')?.id).toBe('autopista-central');
    expect(matchBrand('Costanera Norte')?.id).toBe('costanera-norte');
    expect(matchBrand('Autopista Vespucio Norte')?.id).toBe('vespucio-norte');
    expect(matchBrand('Cenco Malls')?.id).toBe('malls-de-chile');
  });

  it('"Uber Eats" wins over the broader bare "Uber" entry', () => {
    expect(matchBrand('Uber Eats')?.id).toBe('uber-eats');
    expect(matchBrand('Uber')?.id).toBe('uber');
  });

  it('recognizes "HyM"/"H Y M" written by hand, not just the exact "H&M"/"HM" forms', () => {
    expect(matchBrand('Ropa HyM (2/2)')?.id).toBe('hm');
    expect(matchBrand('H Y M')?.id).toBe('hm');
    expect(matchBrand('H&M')?.id).toBe('hm');
  });

  it('a generic "Luz (electricidad)" concepto resolves to Enel, the default electricity brand', () => {
    expect(matchBrand('Luz (electricidad)')?.id).toBe('enel');
    expect(matchBrand('Electricidad')?.id).toBe('enel');
  });

  it('"CGE" itself is never shown as Enel, even though both cover electricity', () => {
    expect(matchBrand('CGE')?.id).toBe('cge');
  });

  it('a generic "Agua"/"Aguas" concepto resolves to Aguas Andinas', () => {
    expect(matchBrand('Agua')?.id).toBe('aguas-andinas');
    expect(matchBrand('Aguas')?.id).toBe('aguas-andinas');
  });

  it('recognizes the new Metrogas entry from "gas" or its own name', () => {
    expect(matchBrand('Metrogas')?.id).toBe('metrogas');
    expect(matchBrand('Cuenta de Gas')?.id).toBe('metrogas');
  });

  it('generic terms like "Supermercado"/"Super" never resolve to a specific brand -- the category icon stays', () => {
    expect(matchBrand('Supermercado')).toBeNull();
    expect(matchBrand('Super')).toBeNull();
    expect(matchBrand('Compras en el supermercado')).toBeNull();
  });
});
