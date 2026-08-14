package com.rpgcreatorai.editor;

import android.app.Activity;
import android.content.ComponentCallbacks2;
import android.content.pm.PackageInfo;
import android.net.Uri;
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
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Locale;

/**
 * Offline-only Android host for the Vite bundle.
 *
 * The native fallback deliberately contains no WebView content so startup and
 * renderer failures remain actionable even when Chromium itself is unusable.
 */
public final class MainActivity extends Activity {
    private static final String TAG = "RPGCreatorAI.WebView";
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String TRUSTED_PATH = "/assets/www/";
    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/www/index.html";
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

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.rpg_background));
        setContentView(root);

        if (BuildConfig.DEBUG) {
            try {
                WebView.setWebContentsDebuggingEnabled(true);
            } catch (RuntimeException | LinkageError error) {
                // Some damaged or absent providers fail even on this static call.
                // The provider check in startWebView will surface the native fallback.
                Log.w(TAG, "Unable to enable WebView debugging.", error);
            }
        }
        startWebView(false);
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

        try {
            final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                    .setDomain(ASSET_HOST)
                    .addPathHandler(
                            "/assets/",
                            new WebViewAssetLoader.AssetsPathHandler(this))
                    .build();
            final WebView candidate = new WebView(this);
            webView = candidate;
            pageCommitted = false;
            configureWebView(candidate, loader);
            attachLoadingWebView(candidate);
            candidate.loadUrl(START_URL);

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
    private void configureWebView(WebView view, WebViewAssetLoader loader) {
        view.setBackgroundColor(getColor(R.color.rpg_background));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setHorizontalScrollBarEnabled(false);
        view.setVerticalScrollBarEnabled(false);

        final WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setSafeBrowsingEnabled(true);

        final CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(false);
        cookies.setAcceptThirdPartyCookies(view, false);

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView requestedView,
                    WebResourceRequest request) {
                final Uri uri = request.getUrl();
                if (!isTrusted(uri)) return response(403, "Blocked", "offline-only");
                try {
                    final WebResourceResponse local = loader.shouldInterceptRequest(uri);
                    return local != null ? local : response(404, "Not Found", "missing-asset");
                } catch (RuntimeException error) {
                    Log.e(TAG, "Local asset interception failed for " + safeLogUri(uri), error);
                    return response(500, "Asset Error", "asset-error");
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView requestedView,
                    WebResourceRequest request) {
                return !isTrusted(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView requestedView, String url) {
                return !isTrusted(Uri.parse(url));
            }

            @Override
            public void onPageCommitVisible(WebView committedView, String url) {
                if (isTrusted(Uri.parse(url))) markPageCommitted(committedView);
            }

            @Override
            public void onPageFinished(WebView finishedView, String url) {
                if (isTrusted(Uri.parse(url))) markPageCommitted(finishedView);
            }

            @Override
            public void onReceivedError(
                    WebView failedView,
                    WebResourceRequest request,
                    WebResourceError error) {
                if (!request.isForMainFrame()) return;
                Log.e(
                        TAG,
                        String.format(
                                Locale.ROOT,
                                "Main-frame load error %d at %s: %s",
                                error.getErrorCode(),
                                safeLogUri(request.getUrl()),
                                String.valueOf(error.getDescription())));
                runOnUiThread(() -> failCurrentWebView(
                        failedView,
                        R.string.webview_asset_error_title,
                        R.string.webview_asset_error_message));
            }

            @Override
            public void onReceivedHttpError(
                    WebView failedView,
                    WebResourceRequest request,
                    WebResourceResponse errorResponse) {
                if (!request.isForMainFrame()) return;
                Log.e(
                        TAG,
                        "Main-frame HTTP " + errorResponse.getStatusCode()
                                + " at " + safeLogUri(request.getUrl()));
                runOnUiThread(() -> failCurrentWebView(
                        failedView,
                        R.string.webview_asset_error_title,
                        R.string.webview_asset_error_message));
            }

            @Override
            public boolean onRenderProcessGone(
                    WebView failedView,
                    RenderProcessGoneDetail detail) {
                handleRendererGone(failedView, detail);
                return true;
            }
        });
    }

    private void markPageCommitted(WebView committedView) {
        if (destroyed || committedView != webView || pageCommitted) return;
        pageCommitted = true;
        committedView.setVisibility(View.VISIBLE);
        if (nativeFallback != null) {
            root.removeView(nativeFallback);
            nativeFallback = null;
        }
        dispatchEvent(
                "rpgcreator:native-host-ready",
                "{offline:true,origin:'https://" + ASSET_HOST + "'}");
        dispatchLifecycle("resume", "page-committed");

        mainHandler.postDelayed(() -> {
            if (!destroyed && committedView == webView && pageCommitted) {
                rendererFailureTimes.clear();
            }
        }, RENDERER_STABLE_AFTER_MS);
    }

    private void handleRendererGone(WebView failedView, RenderProcessGoneDetail detail) {
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
        try {
            root.removeAllViews();
        } catch (RuntimeException | LinkageError error) {
            // A broken WebView provider can fail during detach. Keep going so a
            // newly added native fallback can cover any orphaned renderer view.
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
        scroll.setBackgroundColor(getColor(R.color.rpg_background));

        final LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(getColor(R.color.rpg_background));

        final LinearLayout.LayoutParams content = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        content.gravity = Gravity.CENTER;
        content.leftMargin = dp(12);
        content.rightMargin = dp(12);

        if (busy) {
            final ProgressBar progress = new ProgressBar(this);
            final LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(dp(36), dp(36));
            progressParams.bottomMargin = dp(20);
            panel.addView(progress, progressParams);
        }

        final TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextColor(getColor(R.color.rpg_text));
        heading.setTextSize(TypedValue.COMPLEX_UNIT_SP, 24);
        heading.setGravity(Gravity.CENTER);
        panel.addView(heading, content);

        final TextView detail = new TextView(this);
        detail.setText(message);
        detail.setTextColor(getColor(R.color.rpg_muted));
        detail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        detail.setGravity(Gravity.CENTER);
        detail.setLineSpacing(0, 1.2f);
        final LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(content);
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

    private void dispatchLifecycle(String state, String reason) {
        dispatchEvent(
                "rpgcreator:native-lifecycle",
                "{state:'" + state + "',reason:'" + reason + "'}");
    }

    private void dispatchEvent(String name, String detailLiteral) {
        final WebView current = webView;
        if (destroyed || current == null || !pageCommitted) return;
        final String script = "window.dispatchEvent(new CustomEvent('"
                + name + "',{detail:" + detailLiteral + "}));";
        try {
            current.evaluateJavascript(script, null);
        } catch (RuntimeException | LinkageError error) {
            Log.e(TAG, "Unable to dispatch native event " + name + ".", error);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        final WebView current = webView;
        if (current != null) {
            try {
                current.onResume();
            } catch (RuntimeException | LinkageError error) {
                Log.e(TAG, "WebView.onResume failed.", error);
            }
        }
        dispatchLifecycle("resume", "activity");
    }

    @Override
    protected void onPause() {
        dispatchLifecycle("pause", "activity");
        final WebView current = webView;
        if (current != null) {
            try {
                current.onPause();
            } catch (RuntimeException | LinkageError error) {
                Log.e(TAG, "WebView.onPause failed.", error);
            }
        }
        super.onPause();
    }

    @Override
    protected void onStop() {
        dispatchLifecycle("stop", "activity");
        super.onStop();
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        final String name;
        if (level == ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) name = "ui-hidden";
        else if (level >= ComponentCallbacks2.TRIM_MEMORY_COMPLETE) name = "complete";
        else if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL) name = "running-critical";
        else name = "running-low";
        dispatchEvent("rpgcreator:native-memory", "{level:'" + name + "'}");
    }

    @Override
    public void onLowMemory() {
        dispatchEvent("rpgcreator:native-memory", "{level:'complete'}");
        super.onLowMemory();
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        ++loadGeneration;
        mainHandler.removeCallbacksAndMessages(null);
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
            view.stopLoading();
        } catch (RuntimeException | LinkageError error) {
            Log.w(TAG, "Stopping a failed WebView was not possible.", error);
        }
        try {
            view.destroy();
        } catch (RuntimeException | LinkageError error) {
            Log.w(TAG, "Destroying a failed WebView was not possible.", error);
        }
    }

    private boolean isTrusted(Uri uri) {
        if (uri == null
                || !"https".equals(uri.getScheme())
                || !ASSET_HOST.equals(uri.getHost())
                || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443)) {
            return false;
        }
        final String path = uri.getPath();
        if (path == null || !path.startsWith(TRUSTED_PATH)) return false;
        for (String segment : uri.getPathSegments()) {
            if ("..".equals(segment)) return false;
        }
        return true;
    }

    private WebResourceResponse response(int status, String reason, String body) {
        return new WebResourceResponse(
                "text/plain",
                StandardCharsets.UTF_8.name(),
                status,
                reason,
                Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private String safeLogUri(Uri uri) {
        return uri == null ? "<null>" : uri.buildUpon().clearQuery().fragment(null).build().toString();
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()));
    }
}
