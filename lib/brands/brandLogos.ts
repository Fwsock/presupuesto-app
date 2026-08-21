/**
 * Local logo image per brand id -- kept in its own file (not brandCatalog.ts)
 * specifically because it's the only place in `lib/brands` that touches
 * React Native's asset pipeline (`require()` of a .png), so brandCatalog.ts
 * itself stays a plain, asset-free TS module the existing Jest setup can
 * test directly with no image-mock config needed.
 *
 * Metro/React Native's `require()` must be given a static, literal path
 * resolved at BUNDLE TIME -- it cannot be built dynamically from whatever
 * files happen to exist in assets/brands/ at runtime, so every brand id gets
 * its own require() line here. Most already point at the real logo file
 * (named however it was originally downloaded -- these were NOT renamed to
 * match the brand id, so the filename here often looks nothing like the id
 * on its left); `central-parking` and `autopark` still have no real logo
 * file, so they point at a transparent 1x1 PNG placeholder -- see
 * PLACEHOLDER_BRAND_IDS below for how MovementIconBadge tells the two apart.
 * Adding a logo for either later needs a real PNG dropped in assets/brands/
 * AND a one-line update here pointing at it, same as any other brand.
 */
export const BRAND_LOGOS: Partial<Record<string, number>> = {
  // Bancos y fintech
  'banco-falabella': require('../../assets/brands/Logotipo_Banco_Falabella.png'),
  'banco-chile': require('../../assets/brands/Banco_de_Chile_Logo.png'),
  'banco-estado': require('../../assets/brands/Logo_BancoEstado.png'),
  santander: require('../../assets/brands/Banco_Santander_Logotipo.png'),
  bci: require('../../assets/brands/Bci_Logotype.png'),
  scotiabank: require('../../assets/brands/Scotiabank_logo.png'),
  itau: require('../../assets/brands/Itau_Unibanco_logo_2023.png'),
  tenpo: require('../../assets/brands/Logotipo_Tenpo.png'),
  mach: require('../../assets/brands/Mach_Logo.png'),
  transbank: require('../../assets/brands/Transbank-1200px-logo.png'),

  // Pagos y servicios
  'mercado-pago': require('../../assets/brands/mercado-pago-1.png'),
  servipag: require('../../assets/brands/Logo_Servipag.png'),
  sencillito: require('../../assets/brands/Sencillito_logo.png'),

  // Salud
  integramedica: require('../../assets/brands/Logo-IntegraMedica.png'),
  'cruz-verde': require('../../assets/brands/Logotipo_Cruz_Verde.png'),
  salcobrand: require('../../assets/brands/cropped-Logo-Salcobrand.fw_.png'),
  'farmacias-ahumada': require('../../assets/brands/logo_ahumada.png'),
  'dr-simi': require('../../assets/brands/Dr_simi_logo.png'),
  bupa: require('../../assets/brands/Bupa-Logo.png'),
  achs: require('../../assets/brands/Logo_ACHS.png'),
  'red-salud': require('../../assets/brands/logo-red-salud.png'),

  // Supermercados
  lider: require('../../assets/brands/Lider-Walmart.png'),
  unimarc: require('../../assets/brands/logo-unimarc.png'),
  jumbo: require('../../assets/brands/Jumbo_2019.png'),
  tottus: require('../../assets/brands/Logo_Tottus.png'),
  'santa-isabel': require('../../assets/brands/Logo_Santa_Isabel_Cencosud.png'),
  alvi: require('../../assets/brands/Alvi_logo.png'),
  'el-trebol': require('../../assets/brands/el_trbol_logo.png'),
  'mayorista-10': require('../../assets/brands/logo_mayorista_10.png'),
  'super-10': require('../../assets/brands/logo_super_10.png'),

  // Retail / tiendas
  falabella: require('../../assets/brands/Falabella.png'),
  paris: require('../../assets/brands/Logo_Paris_Cencosud.png'),
  ripley: require('../../assets/brands/Ripley_Logo.png'),
  'la-polar': require('../../assets/brands/Logotipo_La_Polar.png'),
  tricot: require('../../assets/brands/tricot_logo.png'),
  sodimac: require('../../assets/brands/Logotipo_Sodimac.png'),
  easy: require('../../assets/brands/Easy-Logo.png'),
  hm: require('../../assets/brands/H&M-Logo.png'),
  zara: require('../../assets/brands/Zara_Logo.png'),

  // Malls / estacionamientos
  mallplaza: require('../../assets/brands/Mallplaza_2016_vertical.png'),
  'parque-arauco': require('../../assets/brands/Logo_Parque_Arauco.png'),
  'costanera-center': require('../../assets/brands/Costanera_Center.png'),
  'malls-de-chile': require('../../assets/brands/Cenco_Malls_Logo_2024.png'),
  'central-parking': require('../../assets/brands/central-parking.png'),
  autopark: require('../../assets/brands/autopark.png'),

  // Combustibles
  copec: require('../../assets/brands/Copec_Logo.png'),
  petrobras: require('../../assets/brands/Petrobras-logo.png'),

  // Transporte / delivery
  'uber-eats': require('../../assets/brands/Uber-Eats-logo.png'),
  uber: require('../../assets/brands/Uber_logo_2018.png'),
  cabify: require('../../assets/brands/Cabify-Logo.png'),
  didi: require('../../assets/brands/didi_logo.png'),
  pedidosya: require('../../assets/brands/pedidos_ya_logo.png'),

  // Autopistas / peajes
  'autopista-central': require('../../assets/brands/Autopista_central_logo.png'),
  'costanera-norte': require('../../assets/brands/Logo_Costanera_Norte.png'),
  'vespucio-norte': require('../../assets/brands/Logotipo_Autopista-Vespucio-Norte.png'),

  // Telecom
  entel: require('../../assets/brands/Logo-entel.png'),
  movistar: require('../../assets/brands/Movistar_logo.png'),
  wom: require('../../assets/brands/WOM_logo.png'),
  vtr: require('../../assets/brands/VTRlogo.png'),

  // Servicios basicos
  enel: require('../../assets/brands/Enel_Group_logo.png'),
  cge: require('../../assets/brands/Logo_cge.png'),
  metrogas: require('../../assets/brands/metrogas.png'),
  'aguas-andinas': require('../../assets/brands/Logo_Aguas_Andinas.png'),
};

/**
 * Brand ids whose BRAND_LOGOS entry is still the transparent 1x1 placeholder,
 * not a real logo -- MovementIconBadge uses this to decide whether to show
 * ONLY the logo image (a real one) or fall back to the colored mark/icon
 * badge (no real logo yet). `BRAND_LOGOS[id] != null` alone can't tell these
 * apart, since a placeholder is still a valid, non-null asset reference.
 * Remove an id from here the same moment its real logo file replaces the
 * placeholder in assets/brands/ (both are one-line changes, done together).
 */
export const PLACEHOLDER_BRAND_IDS: ReadonlySet<string> = new Set(['central-parking', 'autopark', 'metrogas']);
