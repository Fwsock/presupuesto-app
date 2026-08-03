# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Protocolo de cierre por tarea/cambio

Para cada tarea o cambio de código que completes (no solo al final de un plan completo):

1. Resume en español qué se implementó o qué bug se arregló.
2. Indica exactamente qué probar en la app para verificar ese cambio.
3. Si el cambio requiere correr algo en el SQL Editor de Supabase, entrega el bloque SQL completo y avisa explícitamente que debe ejecutarse ahí antes de probar.
4. Evalúa si el cambio requiere reiniciar el servidor de Expo (por ejemplo: cambios en dependencias, configuración, variables de entorno, assets, o cualquier cosa que Fast Refresh no recargue bien por sí solo). Si es necesario, reinicia limpiando caché (`--clear` / borrar caché de Metro) y avisa cuando esté listo para probar. Si es un simple ajuste de UI/lógica que Fast Refresh recarga solo, indícalo así y no reinicies innecesariamente.
5. Si estás trabajando en un worktree, el servidor debe levantar apuntando a esa carpeta, nunca a la carpeta original en master.

Al terminar un plan completo de varias tareas, entrega además un resumen consolidado de todos los cambios de principio a fin, con checklist completa de qué probar por cada punto del plan.
