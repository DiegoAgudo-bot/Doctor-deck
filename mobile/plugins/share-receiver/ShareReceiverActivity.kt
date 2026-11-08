package app.doctordeck

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import org.json.JSONObject
import java.io.File

/**
 * Recibe lo que se comparte con Doctor Deck desde otras apps (la lista de un mazo como texto, o el
 * CSV/TXT de la colección como fichero). Lo guarda en `files/shared-inbox/pending.json` (el fichero,
 * copiado al lado) y abre la app como si se abriera desde el icono; la app lo recoge al arrancar o
 * al volver a primer plano y abre la pantalla de importar.
 *
 * Antes lo recibía directamente la actividad de React Native y, si la app ya estaba abierta en
 * segundo plano, a veces se quedaba en negro: así la actividad principal nunca recibe lo compartido.
 */
class ShareReceiverActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      save(intent)
    } catch (e: Throwable) {
      Log.e(TAG, "No se ha podido recibir lo compartido", e)
      try {
        writePending(JSONObject().put("error", e.message ?: e.javaClass.simpleName))
      } catch (ignored: Throwable) {
      }
    }
    try {
      val open = Intent(this, MainActivity::class.java).apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      }
      startActivity(open)
    } catch (e: Throwable) {
      Log.e(TAG, "No se ha podido abrir la app", e)
    }
    finish()
  }

  private fun save(intent: Intent?) {
    if (intent == null) throw IllegalStateException("no llega nada")
    val stream = streamOf(intent)
    if (stream != null) {
      saveFile(stream)
      return
    }
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()
    if (text.isNullOrBlank()) throw IllegalStateException("no llega ni texto ni fichero")
    writePending(JSONObject().put("text", text))
  }

  @Suppress("DEPRECATION")
  private fun streamOf(intent: Intent): Uri? {
    val extra: Uri? = if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
      val list: ArrayList<Uri>? = if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      } else {
        intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
      }
      list?.firstOrNull()
    } else if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM)
    }
    if (extra != null) return extra
    val clip = intent.clipData
    if (clip != null && clip.itemCount > 0) return clip.getItemAt(0).uri
    return null
  }

  private fun saveFile(uri: Uri) {
    val name = displayName(uri) ?: uri.lastPathSegment ?: "compartido.txt"
    val safe = name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80).ifBlank { "compartido.txt" }
    val dir = inboxDir()
    dir.listFiles()?.filter { it.name.startsWith("file-") }?.forEach { it.delete() }
    val target = File(dir, "file-${System.currentTimeMillis()}-$safe")
    val input = contentResolver.openInputStream(uri)
      ?: throw IllegalStateException("no se puede abrir el fichero")
    var total = 0L
    input.use { inp ->
      target.outputStream().use { out ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val n = inp.read(buffer)
          if (n < 0) break
          total += n
          if (total > MAX_BYTES) {
            throw IllegalStateException(
                if (java.util.Locale.getDefault().language == "es") "el fichero es demasiado grande (más de 30 MB)"
                else "the file is too big (over 30 MB)"
            )
          }
          out.write(buffer, 0, n)
        }
      }
    }
    writePending(JSONObject().put("path", target.absolutePath).put("fileName", name))
  }

  private fun displayName(uri: Uri): String? = try {
    contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
      val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (c.moveToFirst() && i >= 0) c.getString(i) else null
    }
  } catch (e: Throwable) {
    null
  }

  private fun inboxDir(): File = File(filesDir, "shared-inbox").apply { mkdirs() }

  /** Escribe `pending.json` de una vez (primero a un temporal), con la hora para no repetirlo. */
  private fun writePending(json: JSONObject) {
    json.put("id", System.currentTimeMillis().toString())
    val dir = inboxDir()
    val tmp = File(dir, "pending.json.tmp")
    tmp.writeText(json.toString())
    val target = File(dir, "pending.json")
    if (!tmp.renameTo(target)) {
      target.writeText(json.toString())
      tmp.delete()
    }
  }

  companion object {
    private const val TAG = "DoctorDeckShare"
    private const val MAX_BYTES = 30L * 1024 * 1024
  }
}
