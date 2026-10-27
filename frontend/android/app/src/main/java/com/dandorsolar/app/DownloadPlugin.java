package com.dandorsolar.app;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves files the web app produces (PDF receipts, CSV exports). The WebView
 * can't follow blob: download links, so the page hands the bytes to this plugin
 * (window.Capacitor.Plugins.DDDownload.saveFile) and it writes them to the
 * phone's Downloads folder, then opens them.
 */
@CapacitorPlugin(name = "DDDownload")
public class DownloadPlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("No file data");
            return;
        }
        String requested = call.getString("filename", "download");
        final String name = new File(requested.isEmpty() ? "download" : requested).getName();
        String type = call.getString("mimeType", "");
        final String mime = (type == null || type.isEmpty()) ? "application/octet-stream" : type;

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                ContentResolver cr = getContext().getContentResolver();
                uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new IllegalStateException("Could not create the file");
                try (OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("Could not write the file");
                    out.write(bytes);
                }
            } else {
                File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir != null && !dir.exists()) dir.mkdirs();
                File file = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                uri = FileProvider.getUriForFile(
                    getContext(), getContext().getPackageName() + ".fileprovider", file
                );
            }

            final Uri saved = uri;
            getActivity().runOnUiThread(() -> {
                Toast.makeText(getContext(), "Saved to Downloads: " + name, Toast.LENGTH_LONG).show();
                Intent open = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(saved, mime)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getActivity().startActivity(open);
                } catch (ActivityNotFoundException ignored) {
                    // No app to open this type — it's still saved in Downloads.
                }
            });
            call.resolve();
        } catch (Exception e) {
            call.reject("Download failed: " + e.getMessage());
        }
    }
}
