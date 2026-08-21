import { fuzzyKeywordMatch } from '../parsers/documentScanParser';

export interface BrandMatch {
  id: string;
  name: string;
  /** Background color for the icon badge (the brand's real, recognizable color) -- also what shows through around/behind the real logo image, see MovementIconBadge. */
  color: string;
  /** 1-2 uppercase letters shown on the badge -- used when there's no distinctive-enough Ionicons glyph for this brand. Mutually exclusive with `icon` in practice, but never enforced: a catalog entry sets exactly one. Both are only ever the FALLBACK now that real logos exist (see brandLogos.ts) -- shown while a brand's logo file is still the transparent placeholder, or if the real image ever fails to load. */
  mark?: string;
  /** Ionicons glyph name (white, on `color`) -- used instead of `mark` when a generic-but-recognizable glyph (a medical kit, a storefront, a bank) reads better than a single letter. */
  icon?: string;
}

interface BrandCatalogEntry extends BrandMatch {
  keywords: string[];
}

// Real brand colors (not a generic palette) -- even with a real logo image
// on top (see MovementIconBadge/brandLogos.ts), this is what shows as the
// badge's background/matte around it, so it should still read as "that
// brand" on its own.
//
// Order matters: matchBrand returns the FIRST entry whose keywords fuzzy-match
// (same "most specific wins" convention as MERCHANT_ALIASES in
// documentScanParser.ts) -- e.g. "Banco Falabella" must be checked before the
// bare retail "Falabella" entry below it, and "Uber Eats" before bare "Uber",
// since each broader keyword is also a substring/word of the more specific one.
const BRAND_CATALOG: BrandCatalogEntry[] = [
  // Bancos y fintech
  { id: 'banco-falabella', name: 'Banco Falabella', color: '#6DC24B', icon: 'card', keywords: ['banco falabella'] },
  {
    id: 'banco-chile',
    name: 'Banco de Chile',
    color: '#0033A0',
    icon: 'business',
    keywords: ['banco de chile', 'bancochile', 'banco chile'],
  },
  {
    id: 'banco-estado',
    name: 'BancoEstado',
    color: '#D52B1E',
    icon: 'business',
    keywords: ['banco estado', 'bancoestado'],
  },
  { id: 'santander', name: 'Santander', color: '#EC0000', icon: 'business', keywords: ['santander'] },
  { id: 'bci', name: 'Bci', color: '#F7941D', icon: 'business', keywords: ['bci', 'banco bci'] },
  { id: 'scotiabank', name: 'Scotiabank', color: '#EC111A', icon: 'business', keywords: ['scotiabank'] },
  { id: 'itau', name: 'Itau', color: '#EC7000', icon: 'business', keywords: ['itau', 'itaú'] },
  { id: 'tenpo', name: 'Tenpo', color: '#8B5CF6', mark: 'T', keywords: ['tenpo'] },
  { id: 'mach', name: 'Mach', color: '#E6007E', mark: 'M', keywords: ['mach'] },
  { id: 'transbank', name: 'Transbank', color: '#0033A0', icon: 'card', keywords: ['transbank'] },

  // Pagos y servicios
  {
    id: 'mercado-pago',
    name: 'Mercado Pago',
    color: '#00AEEF',
    icon: 'storefront',
    keywords: ['mercado pago', 'mercadopago'],
  },
  { id: 'servipag', name: 'Servipag', color: '#3B3B3B', mark: 'SP', keywords: ['servipag'] },
  { id: 'sencillito', name: 'Sencillito', color: '#39B54A', mark: 'S', keywords: ['sencillito'] },

  // Salud
  {
    id: 'integramedica',
    name: 'Integramedica',
    color: '#1B5FAD',
    icon: 'medkit',
    keywords: ['integramedica', 'integra medica'],
  },
  { id: 'cruz-verde', name: 'Cruz Verde', color: '#00A651', mark: 'C', keywords: ['cruz verde'] },
  { id: 'salcobrand', name: 'Salcobrand', color: '#E4032E', mark: 'S', keywords: ['salcobrand'] },
  {
    id: 'farmacias-ahumada',
    name: 'Farmacias Ahumada',
    color: '#004B87',
    mark: 'A',
    keywords: ['farmacias ahumada', 'ahumada'],
  },
  { id: 'dr-simi', name: 'Dr. Simi', color: '#EC008C', icon: 'medical', keywords: ['dr simi', 'simi'] },
  { id: 'bupa', name: 'Bupa', color: '#00205B', icon: 'medkit', keywords: ['bupa'] },
  { id: 'achs', name: 'ACHS', color: '#005EB8', icon: 'medical', keywords: ['achs'] },
  { id: 'red-salud', name: 'Red Salud', color: '#E4032E', icon: 'medical', keywords: ['red salud'] },

  // Supermercados
  { id: 'lider', name: 'Lider', color: '#2E3092', mark: 'L', keywords: ['lider'] },
  { id: 'unimarc', name: 'Unimarc', color: '#E4032E', mark: 'U', keywords: ['unimarc'] },
  { id: 'jumbo', name: 'Jumbo', color: '#EE1C25', mark: 'J', keywords: ['jumbo'] },
  { id: 'tottus', name: 'Tottus', color: '#00A651', mark: 'T', keywords: ['tottus'] },
  { id: 'santa-isabel', name: 'Santa Isabel', color: '#00A99D', mark: 'SI', keywords: ['santa isabel'] },
  { id: 'alvi', name: 'Alvi', color: '#E30613', mark: 'A', keywords: ['alvi'] },
  { id: 'el-trebol', name: 'El Trebol', color: '#00843D', mark: 'T', keywords: ['el trebol', 'trebol'] },
  { id: 'mayorista-10', name: 'Mayorista 10', color: '#D71920', mark: '10', keywords: ['mayorista 10'] },
  { id: 'super-10', name: 'Super 10', color: '#004C97', mark: '10', keywords: ['super 10'] },

  // Retail / tiendas
  { id: 'falabella', name: 'Falabella', color: '#6DC24B', mark: 'F', keywords: ['falabella', 'cmr falabella'] },
  { id: 'paris', name: 'Paris', color: '#A6192E', mark: 'P', keywords: ['paris'] },
  { id: 'ripley', name: 'Ripley', color: '#E4007C', mark: 'R', keywords: ['ripley'] },
  { id: 'la-polar', name: 'La Polar', color: '#00A9E0', mark: 'P', keywords: ['la polar'] },
  { id: 'tricot', name: 'Tricot', color: '#E6007E', mark: 'T', keywords: ['tricot'] },
  { id: 'sodimac', name: 'Sodimac', color: '#EE7100', mark: 'S', keywords: ['sodimac'] },
  { id: 'easy', name: 'Easy', color: '#8DC63F', mark: 'E', keywords: ['easy'] },
  // 'hym'/'h y m' cover how the name actually gets typed by hand -- "Ropa
  // HyM" is a real example, and neither 'h&m' nor bare 'hm' fuzzy-matches
  // "hym" (2-char keywords get zero Levenshtein slack, and "hm" isn't even a
  // substring of "hym" -- the letters are in a different order).
  { id: 'hm', name: 'H&M', color: '#E50010', mark: 'H', keywords: ['h&m', 'hm', 'hym', 'h y m'] },
  { id: 'zara', name: 'Zara', color: '#000000', mark: 'Z', keywords: ['zara'] },

  // Malls / estacionamientos -- same operators already recognized by
  // documentScanParser.ts's own MERCHANT_ALIASES, so a comercio it already
  // extracts correctly also gets its icon here for free.
  {
    id: 'mallplaza',
    name: 'Mallplaza',
    color: '#E4002B',
    mark: 'M',
    keywords: ['mallplaza', 'mall plaza'],
  },
  { id: 'parque-arauco', name: 'Parque Arauco', color: '#00838F', icon: 'business', keywords: ['parque arauco'] },
  {
    id: 'costanera-center',
    name: 'Costanera Center',
    color: '#0B3C5D',
    icon: 'business',
    keywords: ['costanera center'],
  },
  {
    id: 'malls-de-chile',
    name: 'Cenco Malls',
    color: '#546E7A',
    icon: 'business',
    keywords: ['malls de chile', 'cenco malls', 'cencomalls'],
  },
  {
    id: 'central-parking',
    name: 'Central Parking System',
    color: '#455A64',
    icon: 'car',
    keywords: ['central parking', 'parking system'],
  },
  { id: 'autopark', name: 'AutoPark', color: '#455A64', icon: 'car', keywords: ['autopark', 'auto park'] },

  // Combustibles
  { id: 'copec', name: 'Copec', color: '#E4002B', icon: 'car', keywords: ['copec'] },
  { id: 'petrobras', name: 'Petrobras', color: '#00923F', icon: 'car', keywords: ['petrobras'] },

  // Transporte / delivery -- "uber eats" checked BEFORE bare "uber", since
  // "uber" is also a word inside "uber eats" and would otherwise match first.
  { id: 'uber-eats', name: 'Uber Eats', color: '#06C167', icon: 'restaurant', keywords: ['uber eats', 'ubereats'] },
  { id: 'uber', name: 'Uber', color: '#000000', icon: 'car', keywords: ['uber'] },
  { id: 'cabify', name: 'Cabify', color: '#6C2EB5', icon: 'car', keywords: ['cabify'] },
  { id: 'didi', name: 'DiDi', color: '#FF6400', icon: 'car', keywords: ['didi'] },
  { id: 'pedidosya', name: 'PedidosYa', color: '#FA0050', icon: 'bicycle', keywords: ['pedidosya', 'pedidos ya'] },

  // Autopistas / peajes
  { id: 'autopista-central', name: 'Autopista Central', color: '#003DA5', icon: 'car', keywords: ['autopista central'] },
  { id: 'costanera-norte', name: 'Costanera Norte', color: '#004C97', icon: 'car', keywords: ['costanera norte'] },
  {
    id: 'vespucio-norte',
    name: 'Autopista Vespucio Norte',
    color: '#00539F',
    icon: 'car',
    keywords: ['vespucio norte', 'autopista vespucio norte'],
  },

  // Servicios basicos -- 'enel' MUST be checked before Telecom's 'entel'
  // below: 'entel' is a 5-char keyword (1 char of Levenshtein slack, see
  // maxEditDistanceFor), and "enel" is exactly edit-distance 1 from it (one
  // inserted "t") -- a real, easy-to-hit false-positive collision between two
  // genuinely distinct Chilean brands. Checking 'enel' first means a literal
  // "Enel" mention resolves via an exact/homogenized match immediately,
  // before 'entel' ever gets a chance to fuzzy-match it; 'enel' is itself
  // only 4 characters, so it gets ZERO Levenshtein slack and can never
  // fuzzy-match "Entel" the other way around.
  // 'luz'/'electricidad' are generic (not this brand's own name), added here
  // deliberately: this app's own category-icon rules already group
  // 'luz'/'electricidad'/'enel'/'cge' under one generic "flash" glyph (see
  // iconSuggestion.ts), and Enel is Chile's largest electricity distributor
  // -- a bare "Luz (electricidad)" concepto now resolves to Enel's real logo
  // as the sensible default, same as it already defaulted to a generic bolt
  // icon before. 'cge' below stays its own distinct brand, not folded into
  // this -- a receipt/concepto that actually says "CGE" should never show
  // Enel's logo instead.
  { id: 'enel', name: 'Enel', color: '#005CA9', icon: 'flash', keywords: ['enel', 'luz', 'electricidad'] },
  { id: 'cge', name: 'CGE', color: '#004A98', icon: 'flash', keywords: ['cge'] },
  { id: 'metrogas', name: 'Metrogas', color: '#005BAA', icon: 'flame', keywords: ['metrogas', 'gas'] },
  {
    id: 'aguas-andinas',
    name: 'Aguas Andinas',
    color: '#0072BC',
    icon: 'water',
    keywords: ['aguas andinas', 'aguas', 'agua'],
  },

  // Telecom
  { id: 'entel', name: 'Entel', color: '#0033A0', icon: 'call', keywords: ['entel'] },
  { id: 'movistar', name: 'Movistar', color: '#019DF4', icon: 'call', keywords: ['movistar'] },
  { id: 'wom', name: 'WOM', color: '#E6007E', icon: 'call', keywords: ['wom'] },
  { id: 'vtr', name: 'VTR', color: '#E4002B', icon: 'wifi', keywords: ['vtr'] },
];

/** Every catalog id, in declaration order -- lets brandLogos.test.ts assert every brand has a logo (or placeholder) entry without duplicating this list by hand. */
export const BRAND_IDS: readonly string[] = BRAND_CATALOG.map((entry) => entry.id);

/**
 * First known brand whose keyword fuzzily matches `label` (a movement's
 * comercio/concepto text), or null when nothing matches -- callers fall back
 * to the existing generic category icon (see MovementIconBadge). Reuses
 * documentScanParser's fuzzyKeywordMatch, so this tolerates the exact same
 * class of OCR noise the parser itself already handles (a dropped/misread
 * letter -- "uninarc" for "unimarc", "l1der" for "lider" -- not just an exact
 * or hardcoded-typo string).
 */
export function matchBrand(label: string | null | undefined): BrandMatch | null {
  if (!label || !label.trim()) return null;
  for (const entry of BRAND_CATALOG) {
    if (fuzzyKeywordMatch(label, entry.keywords)) {
      const { keywords: _keywords, ...match } = entry;
      return match;
    }
  }
  return null;
}
