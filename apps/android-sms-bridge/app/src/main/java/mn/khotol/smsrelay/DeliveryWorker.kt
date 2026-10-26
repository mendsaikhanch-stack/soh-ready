package mn.khotol.smsrelay

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Дараалалд байгаа SMS-ийг сервер рүү илгээнэ (дүрэм: DeliveryProcessor).
 * 429/5xx/сүлжээний алдаанд WorkManager exponential backoff-оор дахин оролдоно.
 * Ижил messageId дахин очсон ч сервер давхар гүйлгээ үүсгэхгүй.
 */
class DeliveryWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val config = RelayConfig(applicationContext)
        val outbox = Outbox(applicationContext)
        outbox.cleanup()
        val token = config.token()
        if (!config.isConfigured || token == null || config.authBlocked) return@withContext Result.success()

        val api = ApiClient(config.serverUrl, token)
        var retry = false
        try {
            val out = DeliveryProcessor(outbox, api::sendSms).run()
            if (out.delivered > 0) config.lastDeliveryAt = System.currentTimeMillis()
            out.lastError?.let { config.lastError = it }
            when (out.stop) {
                DeliveryProcessor.Stop.AUTH_BLOCKED -> config.authBlocked = true
                DeliveryProcessor.Stop.RETRY_LATER -> retry = true
                DeliveryProcessor.Stop.DRAINED -> Unit
            }
        } catch (e: IOException) {
            config.lastError = "Сүлжээ: ${e.javaClass.simpleName}"
            retry = true
        }

        // Төлөвийн мэдээ — админ дэлгэцэд «утсанд хүлээгдэж буй» тоо харагдана
        try {
            api.heartbeat(outbox.count("pending"), outbox.count("rejected"), config.lastSmsAt, config.lastDeliveryAt)
        } catch (_: IOException) {
        }

        if (retry) Result.retry() else Result.success()
    }

    companion object {
        private val NETWORK = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** SMS ирэх бүрд дуудагдана. */
        fun enqueue(context: Context) {
            val req = OneTimeWorkRequestBuilder<DeliveryWorker>()
                .setConstraints(NETWORK)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork("deliver", ExistingWorkPolicy.APPEND_OR_REPLACE, req)
        }

        /** 15 минут тутам: үлдсэнийг илгээж, heartbeat өгнө (утас дахин асахад ч хадгалагдана). */
        fun schedulePeriodic(context: Context) {
            val req = PeriodicWorkRequestBuilder<DeliveryWorker>(15, TimeUnit.MINUTES)
                .setConstraints(NETWORK)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("deliver-periodic", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
