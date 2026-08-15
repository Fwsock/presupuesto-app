# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Idioma de trabajo

Responde y exprésate siempre en español en este proyecto, en todas las interacciones.

## Modelo de sesión

Usa siempre `/model opusplan` al iniciar una sesión en este proyecto.

## Revisión automática de capturas/imágenes de referencia

En cada tarea o cambio que se te solicite, revisa siempre la carpeta
`/Users/bastian/Pictures/Claude code`:

- Si encuentras imágenes o capturas de pantalla recientes ahí, úsalas como
  referencia para entender el contexto, errores visuales o requisitos de la
  tarea antes de responder o implementar el cambio.
- Si la carpeta está vacía o no hay imágenes relevantes para la tarea actual,
  continúa normalmente con el trabajo según las instrucciones del usuario, sin
  bloquear ni preguntar por ello.

## Protocolo de cierre por tarea/cambio

Para cada tarea o cambio de código que completes (no solo al final de un plan completo):

1. Resume en español qué se implementó o qué bug se arregló.
2. Indica exactamente qué probar en la app para verificar ese cambio.
3. Si el cambio requiere correr algo en el SQL Editor de Supabase, entrega el bloque SQL completo y avisa explícitamente que debe ejecutarse ahí antes de probar.
4. Evalúa si el cambio requiere reiniciar el servidor de Expo (por ejemplo: cambios en dependencias, configuración, variables de entorno, assets, o cualquier cosa que Fast Refresh no recargue bien por sí solo). Si es necesario, reinicia limpiando caché (`--clear` / borrar caché de Metro) y avisa cuando esté listo para probar. Si es un simple ajuste de UI/lógica que Fast Refresh recarga solo, indícalo así y no reinicies innecesariamente.
5. Si estás trabajando en un worktree, el servidor debe levantar apuntando a esa carpeta, nunca a la carpeta original en master.

Al terminar un plan completo de varias tareas, entrega además un resumen consolidado de todos los cambios de principio a fin, con checklist completa de qué probar por cada punto del plan.

## Protocolo de conservación de recursos (CPU/RAM)

Este proyecto es un workflow managed de Expo sin `android/` comprometido al repo — cada `eas build --platform android --local` regenera un directorio temporal de prebuild (`/var/folders/.../eas-build-local-nodejs/...`) que EAS borra solo al terminar, pero el **daemon de Gradle que ese build levanta sigue vivo en segundo plano** aunque el directorio ya no exista. Por eso `cd android && ./gradlew --stop` no aplica aquí (no hay ese directorio) — el daemon se identifica y se mata directamente por proceso:

```bash
ps aux | grep GradleDaemon | grep -v grep   # confirmar PID
kill <pid>                                   # o kill -9 si no responde
```

Reglas a seguir en todo momento, sin que el usuario tenga que pedirlo cada vez:

1. Antes de lanzar un nuevo build local o servidor de preview, revisa si quedó alguno anterior corriendo (`ps aux | grep -iE "gradle|expo start|http.server"`) y detenlo si ya cumplió su propósito o quedó redundante.
2. Al terminar cualquier `eas build --platform android --local`, mata el/los `GradleDaemon` que haya dejado vivos (ver comando arriba) — no esperes a que el usuario lo note.
3. No dejes `npx expo start` corriendo indefinidamente salvo que el usuario lo esté probando activamente o lo haya pedido explícitamente — este proyecto además se prueba casi siempre vía APK standalone, no vía Metro/Expo Go, así que rara vez hace falta tenerlo levantado.
4. Un servidor HTTP local usado para servir un APK recién compilado (`python3 -m http.server`) puede quedar corriendo mientras ese build siga siendo el vigente para instalar — pero avisa que existe y bájalo apenas quede obsoleto (se generó uno nuevo, o el usuario ya terminó de probar).

## Artifact de instalación tras un build local

Cada vez que termines un build local de Android (`eas build --platform
android --local`), sin que el usuario tenga que pedirlo:

1. Genera un Artifact HTML interactivo tipo "Instalar build de prueba" que
   incluya: el código QR visual escaneable apuntando al APK, el link directo
   a la IP local HTTP donde quedó servido, y los pasos de instalación
   (misma WiFi, escanear o tocar el link, permitir "apps de fuentes
   desconocidas" si Android lo pide, instalar y abrir).
2. Publica ese Artifact y entrega su URL en la terminal al usuario para que
   pueda abrirlo y descargar el APK desde el celular.
3. Si ya existe un Artifact de este tipo publicado en la conversación
   (mismo archivo/URL), actualízalo en vez de crear uno nuevo cada vez que
   cambien la IP, el puerto o el build.
