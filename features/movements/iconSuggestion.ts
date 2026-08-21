// Ionicons names — @expo/vector-icons already includes Ionicons (used by the
// tab bar), so no new icon library was needed for this.
export const DEFAULT_MOVEMENT_ICON = 'receipt-outline';

interface IconRule {
  keywords: string[];
  icon: string;
}

const ICON_RULES: IconRule[] = [
  {
    keywords: [
      'supermercado',
      'super',
      'feria',
      'almacen',
      'verduleria',
      'lider',
      'jumbo',
      'tottus',
      'unimarc',
      'santa isabel',
      'mayorista 10',
      'erbi',
      'oxxo',
      'ok market',
      'mercaderia',
    ],
    icon: 'cart-outline',
  },
  {
    keywords: [
      'restaurante',
      'resto',
      'almuerzo',
      'cena',
      'comida',
      'delivery',
      'rappi',
      'pedidosya',
      'mcdonalds',
      'burger',
      'kfc',
      'starbucks',
      'cafeteria',
      'sushi',
      'pizzeria',
    ],
    icon: 'restaurant-outline',
  },
  {
    keywords: [
      'bencina',
      'combustible',
      'gasolina',
      'uber',
      'taxi',
      'cabify',
      'didi',
      'estacionamiento',
      'peaje',
      'auto',
      'copec',
      'shell',
      'petrobras',
      'bip',
      'metro',
    ],
    icon: 'car-outline',
  },
  { keywords: ['arriendo', 'dividendo', 'gastos comunes', 'hogar'], icon: 'home-outline' },
  { keywords: ['luz', 'electricidad', 'enel', 'cge'], icon: 'flash-outline' },
  { keywords: ['agua', 'aguas andinas'], icon: 'water-outline' },
  { keywords: ['internet', 'wifi', 'vtr', 'mundo'], icon: 'wifi-outline' },
  { keywords: ['celular', 'telefono', 'entel', 'claro', 'movistar', 'wom', 'plan'], icon: 'call-outline' },
  {
    keywords: [
      'farmacia',
      'doctor',
      'medico',
      'clinica',
      'salud',
      'dental',
      'dentista',
      'isapre',
      'cruz verde',
      'ahumada',
      'salcobrand',
      'dr simi',
      'simi',
      'consulta',
      'remedio',
    ],
    icon: 'medical-outline',
  },
  { keywords: ['gimnasio', 'gym', 'fitness', 'entrenamiento'], icon: 'fitness-outline' },
  { keywords: ['colegio', 'universidad', 'matricula', 'curso', 'educacion'], icon: 'school-outline' },
  { keywords: ['vuelo', 'viaje', 'pasaje', 'hotel', 'avion'], icon: 'airplane-outline' },
  { keywords: ['regalo', 'cumpleanos', 'cumple'], icon: 'gift-outline' },
  { keywords: ['ropa', 'zapatillas', 'zapatos', 'vestuario'], icon: 'shirt-outline' },
  {
    keywords: ['peluqueria', 'barberia', 'barber', 'salon', 'estetica', 'manicure', 'corte de pelo', 'corte', 'pelo'],
    icon: 'cut-outline',
  },
  { keywords: ['mascota', 'perro', 'gato', 'veterinario', 'petshop'], icon: 'paw-outline' },
  { keywords: ['netflix', 'hbo', 'disney', 'streaming', 'spotify'], icon: 'film-outline' },
  { keywords: ['juego', 'videojuego', 'playstation', 'xbox', 'steam'], icon: 'game-controller-outline' },
  { keywords: ['libro', 'libreria'], icon: 'book-outline' },
  { keywords: ['sueldo', 'salario', 'honorario', 'remuneracion'], icon: 'cash-outline' },
  { keywords: ['tarjeta', 'credito', 'cmr', 'visa', 'mastercard'], icon: 'card-outline' },
  { keywords: ['ahorro'], icon: 'wallet-outline' },
  { keywords: ['inversion', 'acciones', 'fondo mutuo'], icon: 'trending-up-outline' },
  { keywords: ['reparacion', 'mantencion', 'ferreteria', 'sodimac', 'easy'], icon: 'construct-outline' },
  { keywords: ['bar', 'cerveza', 'trago', 'fiesta', 'salida'], icon: 'beer-outline' },
  { keywords: ['transferencia', 'transf', 'traspaso'], icon: 'swap-horizontal-outline' },
  { keywords: ['polla', 'rifa', 'sorteo'], icon: 'people-outline' },
  { keywords: ['falabella', 'ripley', 'paris', 'tienda'], icon: 'bag-outline' },
  { keywords: ['chilexpress', 'starken', 'correos', 'envio'], icon: 'cube-outline' },
];

/** Lowercased, accent-stripped (NFD) comparison so "Peluquería"/"PELUQUERIA"/"peluqueria" all match the same keyword. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function suggestMovementIcon(concepto: string): string {
  const normalized = normalize(concepto);
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
      return rule.icon;
    }
  }
  return DEFAULT_MOVEMENT_ICON;
}

export const AVAILABLE_MOVEMENT_ICONS: string[] = Array.from(
  new Set([DEFAULT_MOVEMENT_ICON, ...ICON_RULES.map((rule) => rule.icon)])
);
