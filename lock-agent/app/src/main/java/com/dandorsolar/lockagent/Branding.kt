package com.dandorsolar.lockagent

import android.app.WallpaperManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.os.UserManager
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Staff phones: the company logo is the home-screen AND lock-screen wallpaper,
 * and staff can't change it (Device Owner restriction). Re-applied whenever the
 * logo changes or someone manages to change the wallpaper. Lifted on release.
 */
object Branding {
    private const val TAG = "DDAgent"
    private const val DESIGN = 1 // bump to redraw on every phone
    private const val LOGO_FILE = "brand_logo.img"

    /** Call off the main thread (it may download the logo). */
    fun apply(c: Context, logoUrl: String?, contact: String) {
        if (!Policy.isOwner(c) || !Prefs.enrolled(c)) return
        if (Prefs.desiredLockState(c) == "released") return
        val wm = WallpaperManager.getInstance(c)
        val url = logoUrl?.takeIf { it.startsWith("https://") } ?: ""
        if (url != Prefs.brandLogoUrl(c)) {
            if (url.isEmpty() || download(c, url)) Prefs.setBrandLogoUrl(c, url)
        }
        val key = "$DESIGN|${Prefs.brandLogoUrl(c)}|$contact|${Prefs.businessName(c)}"
        if (key == Prefs.brandKey(c) && ids(wm) == Prefs.brandIds(c)) {
            restrict(c, true) // already showing our wallpaper
            return
        }
        val bmp = runCatching { draw(c, contact) }.getOrNull() ?: return
        restrict(c, false) // our own change is allowed; staff's are not
        val ok = runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                wm.setBitmap(bmp, null, true, WallpaperManager.FLAG_SYSTEM)
                wm.setBitmap(bmp, null, true, WallpaperManager.FLAG_LOCK)
            } else {
                wm.setBitmap(bmp)
            }
        }.onFailure { Log.w(TAG, "wallpaper failed: ${it.message}") }.isSuccess
        restrict(c, true)
        if (ok) Prefs.setBrandApplied(c, key, ids(wm))
    }

    /** Lift the wallpaper lock (release / no longer a staff phone). */
    fun remove(c: Context) {
        if (Prefs.brandKey(c).isEmpty()) return
        restrict(c, false)
        runCatching { WallpaperManager.getInstance(c).clear() }
        Prefs.setBrandApplied(c, "", "")
    }

    private fun restrict(c: Context, on: Boolean) {
        if (!Policy.isOwner(c)) return
        val dpm = Policy.dpm(c); val admin = Policy.admin(c)
        runCatching {
            if (on) dpm.addUserRestriction(admin, UserManager.DISALLOW_SET_WALLPAPER)
            else dpm.clearUserRestriction(admin, UserManager.DISALLOW_SET_WALLPAPER)
        }
    }

    private fun ids(wm: WallpaperManager): String =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) runCatching {
            "${wm.getWallpaperId(WallpaperManager.FLAG_SYSTEM)}/${wm.getWallpaperId(WallpaperManager.FLAG_LOCK)}"
        }.getOrDefault("") else ""

    private fun download(c: Context, url: String): Boolean = runCatching {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000; conn.readTimeout = 20000
        conn.instanceFollowRedirects = true
        try {
            if (conn.responseCode !in 200..299) return false
            val bytes = conn.inputStream.use { it.readBytes() }
            if (bytes.size > 5 * 1024 * 1024) return false
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return false
            File(c.filesDir, LOGO_FILE).writeBytes(bytes)
            true
        } finally { conn.disconnect() }
    }.getOrDefault(false)

    private fun logo(c: Context): Bitmap? {
        val f = File(c.filesDir, LOGO_FILE)
        if (Prefs.brandLogoUrl(c).isNotEmpty() && f.exists()) {
            BitmapFactory.decodeFile(f.absolutePath)?.let { return it }
        }
        return BitmapFactory.decodeResource(c.resources, R.drawable.brand_logo)
    }

    @Suppress("DEPRECATION")
    private fun screen(c: Context): Pair<Int, Int> {
        val dm = runCatching {
            DisplayMetrics().also { (c.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.getRealMetrics(it) }
        }.getOrNull()?.takeIf { it.widthPixels > 0 } ?: c.resources.displayMetrics
        val w = dm.widthPixels.coerceIn(480, 1600)
        val h = dm.heightPixels.coerceIn(800, 3400)
        return if (w < h) w to h else h to w
    }

    /** Dark warm background, the logo on a white card, the company name and number. */
    private fun draw(c: Context, contact: String): Bitmap {
        val (w, h) = screen(c)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.shader = LinearGradient(0f, 0f, w * 0.4f, h.toFloat(),
            Color.rgb(0x2a, 0x12, 0x06), Color.rgb(0x0a, 0x06, 0x03), Shader.TileMode.CLAMP)
        cv.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
        p.shader = RadialGradient(w / 2f, h * 0.36f, w * 0.85f,
            Color.argb(110, 0xf9, 0x73, 0x16), Color.TRANSPARENT, Shader.TileMode.CLAMP)
        cv.drawRect(0f, 0f, w.toFloat(), h.toFloat(), p)
        p.shader = null

        val card = w * 0.56f
        val left = (w - card) / 2f
        val top = h * 0.40f - card / 2f
        p.color = Color.WHITE
        cv.drawRoundRect(RectF(left, top, left + card, top + card), card * 0.12f, card * 0.12f, p)
        logo(c)?.let { lg ->
            val pad = card * 0.06f
            val box = card - 2 * pad
            val scale = minOf(box / lg.width, box / lg.height)
            val lw = lg.width * scale; val lh = lg.height * scale
            val x = left + (card - lw) / 2f; val y = top + (card - lh) / 2f
            cv.drawBitmap(lg, null, RectF(x, y, x + lw, y + lh), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        }

        val t = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textAlign = Paint.Align.CENTER }
        t.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        t.textSize = w * 0.058f
        var y = top + card + w * 0.13f
        cv.drawText(Prefs.businessName(c).take(40), w / 2f, y, t)
        t.typeface = Typeface.DEFAULT
        t.textSize = w * 0.038f
        t.color = Color.argb(200, 255, 255, 255)
        y += w * 0.07f
        cv.drawText("Company phone \u00b7 managed by Dan & Dor Solar", w / 2f, y, t)
        if (contact.isNotEmpty()) {
            y += w * 0.06f
            t.color = Color.rgb(0xfd, 0xba, 0x74)
            cv.drawText("If found, please call $contact", w / 2f, y, t)
        }
        return bmp
    }
}
