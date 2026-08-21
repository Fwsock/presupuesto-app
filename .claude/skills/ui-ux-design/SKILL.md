---
name: ui-ux-design
description: Guía y audita el diseño de interfaz para lograr un look Neobanco moderno (estilo Revolut, Fintual, NuBank) en React Native.
---

### Principios de Diseño Neobanco (FinanFlow)

1. **Tipografía Numérica y Tabular:**
   - Todos los componentes de montos (`$`) deben implementar números tabulares: `fontVariant: ['tabular-nums']` en React Native.
   - Usar jerarquía clara: Moneda/Signo en tono atenuado, enteros en SemiBold/Bold, y decimales alineados.

2. **Sistemas de Tarjetas y Bordes:**
   - Eliminar sombras oscuras pesadas. Usar bordes sutiles de `1px` con baja opacidad (`rgba(0, 0, 0, 0.05)` o `#F1F5F9`).
   - Radios de borde consistentes: `borderRadius: 16` para cards/contenedores, `borderRadius: 999` para pills/badges.

3. **Paleta Neobanco Limpia:**
   - Fondo general: `#F8FAFC` o `#FAFAFA`.
   - Cards/Contenedores: `#FFFFFF`.
   - Ingresos: `#10B981` (Verde Esmeralda).
   - Gastos: `#EF4444` (Rojo Carmesí Suave) o neutral `#0F172A`.
   - Texto secundario: `#64748B`.

4. **Metodología de Auditoría Visual:**
   - Siempre que se edite un componente UI, verifica el contraste (WCAG AA), espaciados en múltiplos de 8px (8, 16, 24) y alineación vertical/horizontal.
