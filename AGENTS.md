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

## PROTOCOLO DE TRABAJO Y CONTROL DE VERSIONES (WORKFLOW)

### PROTOCOLO OBLIGATORIO DE DESARROLLO Y SEGURIDAD

Para cualquier nueva tarea, mejora o corrección de errores en la aplicación, se debe seguir estrictamente este flujo de 5 fases:

1. FASE DE INICIO Y AUDITORÍA:
   - Verificar `git status` y asegurar que la rama activa sea `master` y no existan cambios locales pendientes ni archivos sensibles expuestos.
   - Si existen ramas locales huérfanas de sesiones anteriores ya integradas, eliminarlas.

2. FASE DE RESPALDO Y AISLAMIENTO:
   - Crear una etiqueta (tag) o punto de restauración de respaldo local llamado `backup-pre-[nombre_tarea]-[FECHA]` apuntando al estado actual de `master`.
   - Crear y cambiar a una rama de trabajo temática global (ej. `feature/[nombre_tarea]`).
   - *Regla de Alcance:* Todos los cambios, experimentos y correcciones derivadas o errores secundarios descubiertos durante la sesión deben trabajarse dentro de esta misma rama temática.

3. FASE DE DESARROLLO Y PRUEBAS:
   - Realizar las modificaciones necesarias.
   - Antes de dar por finalizado un cambio, ejecutar obligatoriamente `tsc` y `jest` para asegurar 0 errores de compilación y 0 pruebas rotas.

4. FASE DE CIERRE Y FUSIÓN A MASTER:
   - Al confirmar que los cambios están listos y probados por el usuario, crear un commit único estructurado en la rama de trabajo.
   - Cambiarse a `master`, hacer `git merge` de la rama de trabajo y realizar `git push origin master`.
   - Eliminar la rama local de la tarea (`feature/...`).

5. FASE DE LIMPIEZA DE RESPALDOS:
   - Revisar las ramas locales existentes (`git branch`).
   - SI Y SOLO SI no existe ninguna otra rama local activa aparte de `master`, proceder a eliminar la etiqueta/tag de respaldo (`backup-pre-...`).
   - Si aún existen otras ramas de trabajo vivas, conservar la etiqueta de respaldo intacta.

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

## Rendimiento de builds locales

`android/gradle.properties` **no se puede editar a mano** en este proyecto:
no hay `android/` comprometido al repo (ver protocolo de arriba), así que cada
`eas build --platform android --local` lo regenera desde cero en un
directorio temporal — cualquier edición manual se pierde en el siguiente
build. El ajuste durable vive en `plugins/withGradlePerf.js` (un config
plugin de Expo, registrado en `app.json`), que reinyecta estas propiedades
en cada prebuild:

- `org.gradle.jvmargs=-Xmx6g -XX:+UseParallelGC -XX:MaxMetaspaceSize=1g`
- `org.gradle.parallel=true`
- `org.gradle.caching=true`
- `org.gradle.configureondemand=true`
- `android.enableJetifier=false`
- `reactNativeArchitectures=arm64-v8a` — **solo cuando `EAS_BUILD_PROFILE=preview`** (`production` sigue compilando las 4 arquitecturas, porque ese perfil sí va a la Play Store).

El heap de 6g está pensado para esta Mac (24GB RAM / 8 núcleos) — bajarlo si
se usa en una máquina con menos RAM. `org.gradle.caching=true` ayuda algo
(la caché de tareas de Gradle vive en `~/.gradle/caches`, fuera del
directorio temporal que se borra en cada build), pero medido en la práctica
**no fue la palanca real**: un build con JVM/paralelismo/caché tuneados
tardó prácticamente lo mismo (859s) que builds anteriores sin ese tuning
(811-950s). No hay ningún paso de "clean" que evitar en `eas build --local`
— el rebuild completo es inherente a que regenera el proyecto entero.

**La palanca que sí importa, medida directamente del profile de Gradle de
un build real:** cada módulo nativo en C++ (Skia, Reanimated, Worklets,
gesture-handler, screens, expo-modules-core) se compila una vez POR
ARQUITECTURA — arm64-v8a, armeabi-v7a, x86, x86_64 — por defecto. Eso es
**31.6% de todo el tiempo de tareas de un build real (577 de 1826s)**,
repartido casi parejo entre las 4, aunque el `preview` profile solo se
instala en un teléfono real (arm64-v8a). `reactNativeArchitectures=arm64-v8a`
(scopeado a `preview` vía el propio plugin, ver arriba) elimina ~3/4 de esa
compilación nativa. Trade-off: un APK `preview` compilado así ya no instala
en emuladores x86/x86_64 ni celulares ARM de 32-bit — para eso, compilar
`production` (o borrar/comentar esa línea) en vez de `preview`.

Script de conveniencia: `npm run build:android:local` (requiere
`JAVA_HOME`/`ANDROID_HOME` ya exportados en el shell, igual que siempre).

## Iterar cambios de JS/TS sin reconstruir el APK nativo completo

**Estado actual de este proyecto: no aplica todavía.** `npx expo start` solo
sirve para probar sin rebuild nativo si la app corre dentro de **Expo Go**
o de un **development build** (un APK con `expo-dev-client` incluido) — este
proyecto no tiene `expo-dev-client` instalado, y además usa módulos nativos
custom (el listener de notificaciones bancarias en `modules/`, ML Kit para
OCR) que Expo Go no puede cargar. Por eso la convención de esta sesión ha
sido probar todo vía APK standalone (`preview` profile), y cualquier cambio
—JS/TS incluido— requiere un build local completo para probarse en el
dispositivo.

**Recomendación para acelerar esto a futuro** (requiere decisión explícita
del usuario antes de aplicarse, porque cambia el flujo de prueba establecido
arriba):
1. Instalar `expo-dev-client` y agregar un perfil `development` en
   `eas.json` (`"developmentClient": true`).
2. Compilar ESE build una sola vez (mismo costo que un build normal).
3. De ahí en adelante, `npx expo start` conecta a ese APK ya instalado vía
   Metro con Fast Refresh — cualquier cambio de JS/TS (parsers, componentes,
   hooks, estilos) se ve al instante, sin recompilar nada nativo. Solo hace
   falta un build nuevo cuando cambian dependencias nativas o config de
   `app.json`/`plugins/` (exactamente los mismos casos en los que hoy ya se
   relanza el build).

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
