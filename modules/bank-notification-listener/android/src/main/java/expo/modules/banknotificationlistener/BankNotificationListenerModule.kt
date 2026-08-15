package expo.modules.banknotificationlistener

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BankNotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BankNotificationListener")

    Events("onBankNotification")

    Function("isPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    // "Notification access" can only be granted by the user from this
    // system settings screen -- there's no runtime permission dialog for it.
    Function("openNotificationSettings") {
      appContext.reactContext?.let { context ->
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    // Catches up on notifications BankNotificationListenerService captured
    // while nothing was listening live (app fully closed, not just
    // backgrounded) -- see that service's class doc for why this queue
    // exists. Called once on app launch from useBankNotificationListener.
    AsyncFunction("drainPersistedNotifications") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, String>>()
      BankNotificationListenerService.drain(context).map { (packageName, text) ->
        mapOf("packageName" to packageName, "text" to text)
      }
    }

    OnCreate {
      BankNotificationListenerService.onNotificationCaptured = { packageName, text ->
        sendEvent("onBankNotification", mapOf("packageName" to packageName, "text" to text))
      }
    }

    OnDestroy {
      BankNotificationListenerService.onNotificationCaptured = null
    }
  }
}
