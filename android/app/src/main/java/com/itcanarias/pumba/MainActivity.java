package com.itcanarias.pumba;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(OtrasAppsPlugin.class);
        super.onCreate(savedInstanceState);
        // La letra la controla el ajuste «Tamaño de letra» de la app: si el móvil tiene la letra del sistema muy grande, el texto se salía de los recuadros
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().getSettings().setTextZoom(100);
        // Mantener la pantalla encendida mientras se juega
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Fondo detrás de las barras del sistema (la app no se dibuja debajo de ellas)
        getWindow().getDecorView().setBackgroundColor(android.graphics.Color.parseColor("#10233d"));
    }
}
