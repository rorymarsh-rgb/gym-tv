package uk.gymtv.app;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Handler;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * A full-screen window onto the gym TV web page.
 * Keeps the screen awake, retries when Wi-Fi is not ready yet,
 * and reloads every few hours to pick up changes.
 */
public class MainActivity extends Activity {

    private static final long RETRY_MS = 5000;
    private static final int DESIGN_WIDTH = 1280;
    private static final long REFRESH_MS = 6L * 60 * 60 * 1000;

    private final Handler handler = new Handler();
    private WebView web;
    private String url;
    private String pageHost;

    private final Runnable reload = new Runnable() {
        @Override
        public void run() {
            if (web != null) fitAndLoad();
        }
    };

    private final Runnable refresh = new Runnable() {
        @Override
        public void run() {
            if (web != null) web.reload();
            handler.postDelayed(this, REFRESH_MS);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);

        url = getString(R.string.tv_url);
        pageHost = Uri.parse(url).getHost();

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#111111"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Always fetch the latest version of the page, so design changes show up straight away.
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // Size the page ourselves (see fitAndLoad), and ignore the system text size setting.
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String u) {
                return false;
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                view.loadData("<html><body style='background:#111;color:#aaa;font:28px sans-serif;padding:60px'>"
                        + "Waiting for the network. Retrying in a few seconds.</body></html>", "text/html", "utf-8");
                handler.removeCallbacks(reload);
                handler.postDelayed(reload, RETRY_MS);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler h, SslError error) {
                // Old Fire OS versions lack some newer certificate authorities.
                // Only for our own two hosts, carry on rather than show a blank screen.
                String host = Uri.parse(error.getUrl()).getHost();
                if (host != null && (host.equals(pageHost) || host.endsWith(".supabase.co"))) {
                    h.proceed();
                } else {
                    h.cancel();
                }
            }
        });

        setContentView(web);
        hideSystemUi();
        // Wait until the window has its real size, then load.
        web.post(new Runnable() {
            @Override
            public void run() {
                fitAndLoad();
            }
        });
        handler.postDelayed(refresh, REFRESH_MS);
    }

    /**
     * The TV page is designed at 1280 x 720. Zoom the web view so that exactly
     * 1280 page pixels span the screen width, whatever the TV's resolution or
     * Fire OS display settings. Then load the page.
     */
    private void fitAndLoad() {
        int w = web.getWidth();
        if (w > 0) {
            web.setInitialScale(Math.max(1, Math.round(w * 100f / DESIGN_WIDTH)));
        }
        web.loadUrl(url);
    }

    private void hideSystemUi() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Menu or the centre button on the remote reloads the page.
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_DPAD_CENTER) {
            fitAndLoad();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        web.destroy();
        web = null;
        super.onDestroy();
    }
}
