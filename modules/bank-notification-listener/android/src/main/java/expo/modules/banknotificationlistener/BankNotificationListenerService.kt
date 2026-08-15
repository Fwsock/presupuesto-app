package expo.modules.banknotificationlistener

import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * The OS starts/binds this independently of the app's own process lifecycle
 * (that's the whole point of NotificationListenerService, and the reason it
 * keeps running while the app is merely backgrounded) -- it can't reach
 * BankNotificationListenerModule directly, so it calls the static
 * onNotificationCaptured hook instead, which the module attaches/detaches
 * as it's created/destroyed.
 *
 * That hook alone isn't enough for a notification that arrives while the
 * app's JS context is fully dead (process killed, not just backgrounded):
 * nothing is listening then, and the event would just be dropped. So every
 * capture is ALSO durably persisted to SharedPreferences here, independent
 * of whether the JS side is currently listening --
 * BankNotificationListenerModule.drainPersistedNotifications() reads and
 * clears this queue the next time the app launches, so nothing captured
 * while the app was fully closed gets lost.
 */
class BankNotificationListenerService : NotificationListenerService() {
  companion object {
    var onNotificationCaptured: ((packageName: String, text: String) -> Unit)? = null

    private const val PREFS_NAME = "bank_notification_queue"
    private const val QUEUE_KEY = "queue"

    @Synchronized
    private fun persist(context: Context, packageName: String, text: String) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val queue = JSONArray(prefs.getString(QUEUE_KEY, "[]"))
      val entry = JSONObject()
      entry.put("packageName", packageName)
      entry.put("text", text)
      queue.put(entry)
      prefs.edit().putString(QUEUE_KEY, queue.toString()).apply()
    }

    @Synchronized
    fun drain(context: Context): List<Pair<String, String>> {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val queue = JSONArray(prefs.getString(QUEUE_KEY, "[]"))
      val result = mutableListOf<Pair<String, String>>()
      for (i in 0 until queue.length()) {
        val entry = queue.getJSONObject(i)
        result.add(entry.getString("packageName") to entry.getString("text"))
      }
      prefs.edit().putString(QUEUE_KEY, "[]").apply()
      return result
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!KnownBankPackages.ALLOWLIST.contains(sbn.packageName)) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    val text = extras.getCharSequence("android.text")?.toString().orEmpty()
    val combined = listOf(title, text).filter { it.isNotBlank() }.joinToString(": ")
    if (combined.isBlank()) return

    persist(applicationContext, sbn.packageName, combined)
    onNotificationCaptured?.invoke(sbn.packageName, combined)
  }
}
