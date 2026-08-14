package ai.rpgcreator.player;

import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

final class OfflineAssetWebViewClient extends WebViewClient {
    static final String HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final String PREFIX = "/assets/www/";
    private static final String ASSET_ROOT = "www/";
    private static final String ALLOWLIST_ASSET = ASSET_ROOT + "data/package-allowlist.json";
    private static final int MAX_ALLOWLIST_CHARACTERS = 1024 * 1024;
    private static final int MAX_ALLOWLIST_ENTRIES = 20_000;
    private static final String CONTENT_SECURITY_POLICY =
            "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; "
                    + "form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                    + "img-src 'self' data: blob:; font-src 'self' data:; "
                    + "media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; "
                    + "manifest-src 'self'";
    private static final String PERMISSIONS_POLICY =
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
    private static final Set<String> SUPPORTED_EXTENSIONS = supportedExtensions();
    private final MainActivity activity;
    private final Set<String> assetAllowlist;

    OfflineAssetWebViewClient(MainActivity activity) {
        this.activity = activity;
        this.assetAllowlist = loadAssetAllowlist(activity);
    }

    boolean isPackageReady() {
        return !assetAllowlist.isEmpty();
    }

    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return blocked(405, "Method not allowed");
        Uri uri = request.getUrl();
        if (!trusted(uri)) return blocked(403, "External request blocked");
        String relative = uri.getEncodedPath().substring(PREFIX.length());
        if (!safe(relative) || !assetAllowlist.contains(relative)) {
            return blocked(404, "Asset not found");
        }
        try {
            WebResourceResponse response = new WebResourceResponse(
                    mime(relative),
                    charset(relative),
                    activity.getAssets().open(ASSET_ROOT + relative));
            response.setResponseHeaders(headers(relative));
            return response;
        } catch (IOException error) {
            return blocked(404, "Asset not found");
        }
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return !entryDocument(request.getUrl());
    }

    @SuppressWarnings("deprecation")
    @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
        return !entryDocument(Uri.parse(url));
    }

    @Override public void onPageCommitVisible(WebView view, String url) {
        if (entryDocument(Uri.parse(url))) activity.onOfflinePageCommitted(view);
    }

    @Override public void onPageFinished(WebView view, String url) {
        if (entryDocument(Uri.parse(url))) activity.onOfflinePageCommitted(view);
    }

    @Override public void onReceivedError(
            WebView view,
            WebResourceRequest request,
            WebResourceError error) {
        if (request.isForMainFrame()) activity.onOfflinePageFailed(view, error.getErrorCode());
    }

    @Override public void onReceivedHttpError(
            WebView view,
            WebResourceRequest request,
            WebResourceResponse errorResponse) {
        if (request.isForMainFrame()) {
            activity.onOfflinePageFailed(view, errorResponse.getStatusCode());
        }
    }

    @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        // A WebView whose renderer died cannot be reused. Recover once by
        // creating a fresh offline WebView; after a second failure the
        // activity shows a bounded native error instead of looping forever.
        activity.recoverFromRendererGone(view, detail);
        return true;
    }

    private static boolean entryDocument(Uri uri) {
        return trusted(uri) && (PREFIX + "index.html").equals(uri.getEncodedPath());
    }

    private static boolean trusted(Uri uri) {
        if (uri == null
                || !"https".equals(uri.getScheme())
                || !HOST.equals(uri.getHost())
                || uri.getUserInfo() != null
                || uri.getPort() != -1
                || uri.getQuery() != null
                || uri.getFragment() != null) {
            return false;
        }
        String encodedPath = uri.getEncodedPath();
        return encodedPath != null
                && encodedPath.startsWith(PREFIX)
                && encodedPath.indexOf('%') < 0
                && encodedPath.indexOf('\\') < 0;
    }

    private static boolean safe(String path) {
        if (path.isEmpty()
                || path.length() > 512
                || path.indexOf('\0') >= 0
                || (path.toLowerCase(Locale.ROOT).endsWith(".html") && !"index.html".equals(path))) {
            return false;
        }
        for (int index = 0; index < path.length(); index++) {
            char value = path.charAt(index);
            if (!((value >= 'A' && value <= 'Z')
                    || (value >= 'a' && value <= 'z')
                    || (value >= '0' && value <= '9')
                    || value == '.'
                    || value == '_'
                    || value == '~'
                    || value == '/'
                    || value == '-')) {
                return false;
            }
        }
        for (String segment : path.split("/")) if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) return false;
        int extensionIndex = path.lastIndexOf('.');
        return extensionIndex >= 0
                && SUPPORTED_EXTENSIONS.contains(path.substring(extensionIndex).toLowerCase(Locale.ROOT));
    }

    private static Set<String> supportedExtensions() {
        Set<String> extensions = new HashSet<>();
        Collections.addAll(
                extensions,
                ".html", ".js", ".mjs", ".css", ".json", ".wasm", ".webmanifest",
                ".avif", ".bmp", ".gif", ".ico", ".jpeg", ".jpg", ".png", ".svg", ".webp",
                ".aac", ".flac", ".m4a", ".mp3", ".oga", ".ogg", ".opus", ".wav",
                ".m4v", ".mp4", ".ogv", ".webm", ".srt", ".vtt",
                ".otf", ".ttf", ".woff", ".woff2");
        return Collections.unmodifiableSet(extensions);
    }

    private static Set<String> loadAssetAllowlist(MainActivity activity) {
        Set<String> paths = new HashSet<>();
        try (InputStream input = activity.getAssets().open(ALLOWLIST_ASSET);
             BufferedReader reader = new BufferedReader(
                     new InputStreamReader(input, StandardCharsets.UTF_8))) {
            StringBuilder json = new StringBuilder();
            char[] chunk = new char[4096];
            int count;
            while ((count = reader.read(chunk)) != -1) {
                if (json.length() + count > MAX_ALLOWLIST_CHARACTERS) return Collections.emptySet();
                json.append(chunk, 0, count);
            }

            JSONObject document = new JSONObject(json.toString());
            if (document.optInt("schemaVersion", -1) != 1
                    || !PREFIX.equals(document.optString("assetBaseUrl", ""))) {
                return Collections.emptySet();
            }
            JSONArray entries = document.optJSONArray("paths");
            if (entries == null || entries.length() > MAX_ALLOWLIST_ENTRIES) return Collections.emptySet();
            for (int index = 0; index < entries.length(); index++) {
                Object value = entries.opt(index);
                if (!(value instanceof String) || !safe((String) value) || !paths.add((String) value)) {
                    return Collections.emptySet();
                }
            }
            if (!paths.contains("index.html")
                    || !paths.contains("data/game-bundle.v1.json")
                    || paths.contains("data/package-allowlist.json")) {
                return Collections.emptySet();
            }
        } catch (Exception error) {
            return Collections.emptySet();
        }
        return Collections.unmodifiableSet(paths);
    }

    private static String mime(String path) {
        String extension = MimeTypeMap.getFileExtensionFromUrl(path).toLowerCase(Locale.ROOT);
        if ("js".equals(extension) || "mjs".equals(extension)) return "text/javascript";
        if ("json".equals(extension)) return "application/json";
        if ("wasm".equals(extension)) return "application/wasm";
        if ("avif".equals(extension)) return "image/avif";
        if ("svg".equals(extension)) return "image/svg+xml";
        if ("webp".equals(extension)) return "image/webp";
        if ("aac".equals(extension)) return "audio/aac";
        if ("flac".equals(extension)) return "audio/flac";
        if ("m4a".equals(extension)) return "audio/mp4";
        if ("oga".equals(extension)) return "audio/ogg";
        if ("opus".equals(extension)) return "audio/opus";
        if ("wav".equals(extension)) return "audio/wav";
        if ("m4v".equals(extension)) return "video/mp4";
        if ("ogv".equals(extension)) return "video/ogg";
        if ("srt".equals(extension)) return "application/x-subrip";
        if ("vtt".equals(extension)) return "text/vtt";
        if ("otf".equals(extension)) return "font/otf";
        if ("ttf".equals(extension)) return "font/ttf";
        if ("woff".equals(extension)) return "font/woff";
        if ("woff2".equals(extension)) return "font/woff2";
        if ("webmanifest".equals(extension)) return "application/manifest+json";
        String detected = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return detected == null ? "application/octet-stream" : detected;
    }

    private static String charset(String path) {
        String type = mime(path);
        return type.startsWith("text/") || type.contains("json") || type.contains("javascript") ? "UTF-8" : null;
    }

    private static Map<String, String> headers(String path) {
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Content-Type-Options", "nosniff");
        headers.put("Referrer-Policy", "no-referrer");
        headers.put("Permissions-Policy", PERMISSIONS_POLICY);
        headers.put(
                "Cache-Control",
                "index.html".equals(path) || "data/game-bundle.v1.json".equals(path)
                        ? "no-store"
                        : "public, max-age=31536000, immutable");
        if ("index.html".equals(path)) headers.put("Content-Security-Policy", CONTENT_SECURITY_POLICY);
        return headers;
    }

    private static WebResourceResponse blocked(int status, String message) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox");
        headers.put("Permissions-Policy", PERMISSIONS_POLICY);
        headers.put("Referrer-Policy", "no-referrer");
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse("text/plain", "UTF-8", status, message, headers, new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }
}
