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
    private static final long REFRESH_MS = 6L * 60 * 60 * 1000;

    private final Handler handler = new Handler();
    private WebView web;
    private String url;
    private String pageHost;

    private final Runnable reload = new Runnable() {
        @Override
        public void run() {
            if (web != null) web.loadUrl(url);
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
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

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
        web.loadUrl(url);
        handler.postDelayed(refresh, REFRESH_MS);
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
            web.loadUrl(url);
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
