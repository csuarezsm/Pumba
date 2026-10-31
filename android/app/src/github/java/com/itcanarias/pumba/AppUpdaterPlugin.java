package com.itcanarias.pumba;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Descarga la nueva versión del APK y abre el instalador de Android.
 * Android siempre pide al usuario que confirme la instalación.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    /** Versión distribuida fuera de Google Play (GitHub): lleva su propio actualizador. */
    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("store", "github");
        call.resolve(r);
    }

    @PluginMethod
    public void setSystemBars(PluginCall call) {
        SystemBars.apply(getActivity(), call);
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject r = new JSObject();
        r.put("allowed", allowed);
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudieron abrir los ajustes: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String startUrl = call.getString("url");
        // Solo se aceptan descargas de las versiones publicadas de esta app
        if (startUrl == null || !startUrl.startsWith("https://github.com/csuarezsm/Pumba/releases/download/")) {
            call.reject("Dirección de descarga no válida");
            return;
        }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("No se pudo crear la carpeta temporal");
                File out = new File(dir, "pumba-update.apk");
                if (out.exists() && !out.delete()) throw new IOException("No se pudo borrar la descarga anterior");

                // GitHub redirige la descarga a otro servidor: seguimos las redirecciones (solo https)
                URL url = new URL(startUrl);
                int code = 0;
                for (int hops = 0; hops < 6; hops++) {
                    c = (HttpURLConnection) url.openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(30000);
                    code = c.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String loc = c.getHeaderField("Location");
                        c.disconnect();
                        if (loc == null) throw new IOException("Redirección sin destino");
                        url = new URL(url, loc);
                        if (!"https".equals(url.getProtocol())) throw new IOException("Descarga no segura");
                        continue;
                    }
                    break;
                }
                if (code != 200) throw new IOException("HTTP " + code);

                long total = c.getContentLengthLong();
                long done = 0;
                int last = -1;
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != last) {
                                last = pct;
                                JSObject p = new JSObject();
                                p.put("pct", pct);
                                notifyListeners("progress", p);
                            }
                        }
                    }
                }

                Uri uri = FileProvider.getUriForFile(getContext(),
                        getContext().getPackageName() + ".fileprovider", out);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo descargar la actualización: " + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }
}
