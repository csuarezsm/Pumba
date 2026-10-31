package com.itcanarias.pumba;

import android.app.Activity;
import android.graphics.Color;
import android.view.View;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.PluginCall;

/** Color de fondo detrás de las barras del sistema (según el tema de colores de la app). */
final class SystemBars {
    private SystemBars() {}

    static void apply(Activity act, PluginCall call) {
        final String color = call.getString("color", "#10233d");
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        act.runOnUiThread(() -> {
            try {
                int c = Color.parseColor(color);
                View decor = act.getWindow().getDecorView();
                decor.setBackgroundColor(c);
                WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(act.getWindow(), decor);
                ctl.setAppearanceLightStatusBars(light);
                ctl.setAppearanceLightNavigationBars(light);
                call.resolve();
            } catch (Exception e) {
                call.reject("Color no válido");
            }
        });
    }
}
