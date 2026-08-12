package expo.modules.banknotificationlistener

/**
 * Package names of banking/fintech apps this listener reacts to -- every
 * other app's notifications are ignored before any text is even read.
 * Verified against Play Store listings as of Aug 2026 (search results, not
 * a device install), so treat this as a starting point, not ground truth:
 * apps do occasionally change package names on a major relaunch, and
 * "Falabella Chile"'s cl.android in particular is worth confirming.
 *
 * To find the real value for a bank not listed (or to check one of these
 * is still current): on a device with that bank's app installed, run
 * `adb shell dumpsys notification` right after it posts a notification and
 * read the pkg= field, or temporarily log every sbn.packageName in
 * BankNotificationListenerService.onNotificationPosted before the allowlist
 * filter is applied.
 */
object KnownBankPackages {
  val ALLOWLIST = setOf(
    "cl.bancochile.mi_banco",  // Banco de Chile / Banco Edwards
    "net.veritran.becl.prod",  // BancoEstado
    "cl.santander.smartphone", // Santander Chile
    "cl.bci.app.personas",     // BCI
    "cl.android",              // Banco Falabella Chile
    "com.krealo.tenpo",        // Tenpo
    "cl.bci.sismo.mach",       // Mach
    "com.mercadopago.wallet",  // Mercado Pago
  )
}
