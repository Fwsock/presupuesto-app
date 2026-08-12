package expo.modules.banknotificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * The OS starts/binds this independently of the app's own process lifecycle
 * (that's the whole point of NotificationListenerService), so it can't reach
 * BankNotificationListenerModule directly -- it calls this static hook
 * instead, which the module attaches/detaches as it's created/destroyed.
 */
class BankNotificationListenerService : NotificationListenerService() {
  companion object {
    var onNotificationCaptured: ((packageName: String, text: String) -> Unit)? = null
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!KnownBankPackages.ALLOWLIST.contains(sbn.packageName)) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString().orEmpty()
    val combined = listOf(title, text).filter { it.isNotBlank() }.joinToString(": ")
    if (combined.isBlank()) return

    onNotificationCaptured?.invoke(sbn.packageName, combined)
  }
}
