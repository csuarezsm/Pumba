package com.itcanarias.pumba;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Versión de Google Play: las actualizaciones las hace la propia tienda,
 * así que aquí no hay descarga ni instalación de APK.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("store", "play");
        call.resolve(r);
    }

    @PluginMethod
    public void setSystemBars(PluginCall call) {
        SystemBars.apply(getActivity(), call);
    }
}
