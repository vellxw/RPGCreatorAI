package ai.rpgcreator.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import java.util.ArrayDeque;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String TAG = "RPGCreatorAI.Player";
    private static final long STARTUP_TIMEOUT_MS = 15_000L;
    private static final long RENDERER_RETRY_WINDOW_MS = 30_000L;
    private static final long RENDERER_STABLE_AFTER_MS = 10_000L;
    private static final long RENDERER_BASE_RETRY_DELAY_MS = 250L;
    private static final int MAX_AUTOMATIC_RENDERER_RETRIES = 2;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<Long> rendererFailureTimes = new ArrayDeque<>();

    private FrameLayout root;
    private WebView webView;
    private View nativeFallback;
    private boolean pageCommitted;
    private boolean destroyed;
    private int loadGeneration;
    private OnBackInvokedCallback backInvokedCallback;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(9, 11, 16));
        setContentView(root);

        try {
            WebView.setWebContentsDebuggingEnabled(false);
        } catch (RuntimeException | LinkageError error) {
            // A missing or damaged provider can fail even on this static call.
            // startWebView performs the actionable provider/constructor check.
            Log.w(TAG, "Unable to disable WebView debugging.", error);
        }

        startWebView(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backInvokedCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, backInvokedCallback);
        }
    }

    private void startWebView(boolean manualRetry) {
        if (destroyed) return;
        if (manualRetry) rendererFailureTimes.clear();

        final int generation = ++loadGeneration;
        disposeCurrentWebView();
        showNativeFallback(
                getString(R.string.webview_starting_title),
                getString(R.string.webview_starting_message),
                false,
                true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            final PackageInfo provider;
            try {
                provider = WebView.getCurrentWebViewPackage();
            } catch (RuntimeException | LinkageError error) {
                Log.e(TAG, "Unable to inspect the system WebView provider.", error);
                showWebViewUnavailable();
                return;
            }
            if (provider == null) {
                Log.e(TAG, "No enabled Android System WebView provider was found.");
                showWebViewUnavailable();
                return;
            }
        }

        try {
            final OfflineAssetWebViewClient client = new OfflineAssetWebViewClient(this);
            if (!client.isPackageReady()) {
                Log.e(TAG, "The packaged offline asset allowlist is missing or invalid.");
                showNativeFallback(
                        getString(R.string.webview_asset_error_title),
                        getString(R.string.webview_asset_error_message),
                        true,
                        false);
                return;
            }

            final WebView candidate = new WebView(this);
            webView = candidate;
            pageCommitted = false;
            configureWebView(candidate, client);
            attachLoadingWebView(candidate);
            candidate.loadUrl(OfflineAssetWebViewClient.START_URL);

            mainHandler.postDelayed(() -> {
                if (!destroyed
                        && generation == loadGeneration
                        && candidate == webView
                        && !pageCommitted) {
                    Log.e(TAG, "The packaged start page did not commit before the timeout.");
                    failCurrentWebView(
                            candidate,
                            R.string.webview_timeout_title,
                            R.string.webview_timeout_message);
                }
            }, STARTUP_TIMEOUT_MS);
        } catch (RuntimeException | LinkageError error) {
            Log.e(TAG, "Unable to initialize Android WebView.", error);
            disposeCurrentWebView();
            showWebViewUnavailable();
        }
    }

    @SuppressWarnings("deprecation")
    private void configureWebView(WebView view, OfflineAssetWebViewClient client) {
        view.setBackgroundColor(Color.rgb(9, 11, 16));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setHorizontalScrollBarEnabled(false);
        view.setVerticalScrollBarEnabled(false);
        view.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setBlockNetworkLoads(true);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        // Safe Browsing was added in API 26; minSdk remains 24 for the
        // offline player, so guard the call on older devices.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
        view.addJavascriptInterface(new NativeSaveBridge(getFilesDir()), "RPGCreatorAndroid");
        view.setWebViewClient(client);
    }

    void onOfflinePageCommitted(WebView committedView) {
        if (destroyed || committedView != webView || pageCommitted) return;
        pageCommitted = true;
        committedView.setVisibility(View.VISIBLE);
        if (nativeFallback != null) {
            root.removeView(nativeFallback);
            nativeFallback = null;
        }
        signal("resume");

        mainHandler.postDelayed(() -> {
            if (!destroyed && committedView == webView && pageCommitted) {
                rendererFailureTimes.clear();
            }
        }, RENDERER_STABLE_AFTER_MS);
    }

    void onOfflinePageFailed(WebView failedView, int statusCode) {
        Log.e(TAG, "The packaged start page failed with status " + statusCode + ".");
        runOnUiThread(() -> failCurrentWebView(
                failedView,
                R.string.webview_asset_error_title,
                R.string.webview_asset_error_message));
    }

    void recoverFromRendererGone(WebView failedView, RenderProcessGoneDetail detail) {
        final boolean wasCurrent = failedView == webView;
        Log.e(
                TAG,
                "WebView renderer exited; didCrash=" + detail.didCrash()
                        + ", priority=" + detail.rendererPriorityAtExit());

        if (wasCurrent) {
            webView = null;
            pageCommitted = false;
            ++loadGeneration;
        }
        disposeWebView(failedView);
        if (!wasCurrent || destroyed) return;

        final long now = SystemClock.elapsedRealtime();
        while (!rendererFailureTimes.isEmpty()
                && rendererFailureTimes.peekFirst() < now - RENDERER_RETRY_WINDOW_MS) {
            rendererFailureTimes.removeFirst();
        }
        rendererFailureTimes.addLast(now);
        final int attempt = rendererFailureTimes.size();

        if (attempt <= MAX_AUTOMATIC_RENDERER_RETRIES) {
            final int recoveryGeneration = loadGeneration;
            showNativeFallback(
                    getString(R.string.renderer_recovering_title),
                    getString(
                            R.string.renderer_recovering_message,
                            attempt,
                            MAX_AUTOMATIC_RENDERER_RETRIES),
                    false,
                    true);
            final long delay = RENDERER_BASE_RETRY_DELAY_MS * (1L << (attempt - 1));
            mainHandler.postDelayed(() -> {
                if (!destroyed
                        && webView == null
                        && recoveryGeneration == loadGeneration) {
                    startWebView(false);
                }
            }, delay);
        } else {
            showNativeFallback(
                    getString(R.string.renderer_failed_title),
                    getString(R.string.renderer_failed_message),
                    true,
                    false);
        }
    }

    private void failCurrentWebView(WebView failedView, int titleId, int messageId) {
        if (destroyed || failedView != webView) return;
        ++loadGeneration;
        disposeCurrentWebView();
        showNativeFallback(getString(titleId), getString(messageId), true, false);
    }

    private void showWebViewUnavailable() {
        showNativeFallback(
                getString(R.string.webview_unavailable_title),
                getString(R.string.webview_unavailable_message),
                true,
                false);
    }

    private void attachLoadingWebView(WebView candidate) {
        clearRootForReplacement();
        candidate.setVisibility(View.INVISIBLE);
        root.addView(candidate, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        nativeFallback = createNativeFallback(
                getString(R.string.webview_starting_title),
                getString(R.string.webview_starting_message),
                false,
                true);
        root.addView(nativeFallback, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void showNativeFallback(
            CharSequence title,
            CharSequence message,
            boolean allowRetry,
            boolean busy) {
        clearRootForReplacement();
        nativeFallback = createNativeFallback(title, message, allowRetry, busy);
        root.addView(nativeFallback, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void clearRootForReplacement() {
        if (root == null) return;
        try {
            root.removeAllViews();
        } catch (RuntimeException | LinkageError error) {
            Log.w(TAG, "Clearing the host view hierarchy was not possible.", error);
        }
    }

    private View createNativeFallback(
            CharSequence title,
            CharSequence message,
            boolean allowRetry,
            boolean busy) {
        final ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackgroundColor(Color.rgb(9, 11, 16));

        final LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(Color.rgb(9, 11, 16));

        if (busy) {
            final ProgressBar progress = new ProgressBar(this);
            final LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(36), dp(36));
            progressParams.gravity = Gravity.CENTER_HORIZONTAL;
            progressParams.bottomMargin = dp(20);
            panel.addView(progress, progressParams);
        }

        final TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextColor(Color.WHITE);
        heading.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        heading.setGravity(Gravity.CENTER);
        panel.addView(heading, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        final TextView detail = new TextView(this);
        detail.setText(message);
        detail.setTextColor(Color.rgb(205, 201, 207));
        detail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        detail.setGravity(Gravity.CENTER);
        detail.setLineSpacing(0, 1.2f);
        final LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.topMargin = dp(14);
        detailParams.bottomMargin = dp(22);
        panel.addView(detail, detailParams);

        final LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER);

        if (allowRetry) {
            final Button retry = new Button(this);
            retry.setText(R.string.action_retry);
            retry.setOnClickListener(ignored -> startWebView(true));
            actions.addView(retry);
        }

        final Button close = new Button(this);
        close.setText(R.string.action_close);
        close.setOnClickListener(ignored -> finish());
        actions.addView(close);
        panel.addView(actions);

        scroll.addView(panel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        return scroll;
    }

    private void signal(String type) {
        final WebView current = webView;
        if (destroyed || current == null || !pageCommitted) return;
        try {
            JSONObject detail = new JSONObject()
                    .put("type", type)
                    .put("timestampMs", SystemClock.elapsedRealtime());
            current.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('rpgcreator:android-lifecycle',{detail:"
                            + detail + "}));",
                    null);
        } catch (RuntimeException | LinkageError error) {
            Log.w(TAG, "Unable to dispatch Android lifecycle event " + type + ".", error);
        } catch (Exception error) {
            Log.w(TAG, "Unable to encode Android lifecycle event " + type + ".", error);
        }
    }

    @Override protected void onResume() {
        super.onResume();
        final WebView current = webView;
        if (current != null) {
            try {
                current.onResume();
            } catch (RuntimeException | LinkageError error) {
                Log.w(TAG, "WebView.onResume failed.", error);
            }
        }
        signal("resume");
    }

    @Override protected void onPause() {
        signal("pause");
        final WebView current = webView;
        if (current != null) {
            try {
                current.onPause();
            } catch (RuntimeException | LinkageError error) {
                Log.w(TAG, "WebView.onPause failed.", error);
            }
        }
        super.onPause();
    }

    @Override protected void onStop() {
        signal("stop");
        super.onStop();
    }

    @Override protected void onDestroy() {
        destroyed = true;
        ++loadGeneration;
        mainHandler.removeCallbacksAndMessages(null);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backInvokedCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backInvokedCallback);
            backInvokedCallback = null;
        }
        disposeCurrentWebView();
        super.onDestroy();
    }

    private void disposeCurrentWebView() {
        final WebView current = webView;
        webView = null;
        pageCommitted = false;
        if (current != null) disposeWebView(current);
    }

    private void disposeWebView(WebView view) {
        try {
            final ViewParent parent = view.getParent();
            if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(view);
        } catch (RuntimeException | LinkageError error) {
            Log.w(TAG, "Detaching a failed WebView was not possible.", error);
        }
        try {
            view.removeJavascriptInterface("RPGCreatorAndroid");
            view.stopLoading();
            view.destroy();
        } catch (RuntimeException | LinkageError error) {
            Log.w(TAG, "Destroying a failed WebView was not possible.", error);
        }
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else finish();
    }

    @SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() {
        handleBack();
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()));
    }
}
