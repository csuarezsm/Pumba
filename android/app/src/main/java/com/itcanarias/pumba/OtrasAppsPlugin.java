package com.itcanarias.pumba;

import android.content.Intent;
import android.content.pm.PackageManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * «Más juegos de IT Canarias»: saber qué otras apps de IT Canarias están instaladas y abrirlas.
 * Solo ve los paquetes declarados en <queries> del AndroidManifest (las apps de IT Canarias).
 */
@CapacitorPlugin(name = "OtrasApps")
public class OtrasAppsPlugin extends Plugin {

    private static boolean nuestra(String id) {
        return id != null && id.startsWith("com.itcanarias.") && id.matches("[a-z0-9_.]+");
    }

    @PluginMethod
    public void instaladas(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        JSArray out = new JSArray();
        PackageManager pm = getContext().getPackageManager();
        for (int i = 0; i < ids.length(); i++) {
            String id = ids.optString(i, null);
            if (nuestra(id) && pm.getLaunchIntentForPackage(id) != null) out.put(id);
        }
        JSObject r = new JSObject();
        r.put("ids", out);
        call.resolve(r);
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        String id = call.getString("id", "");
        Intent it = nuestra(id) ? getContext().getPackageManager().getLaunchIntentForPackage(id) : null;
        if (it == null) { call.reject("No está instalada"); return; }
        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(it);
        call.resolve();
    }
}
