package ai.rpgcreator.player;

import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

final class NativeSaveBridge {
    private static final int MAX_BYTES = 1024 * 1024;
    private final File saveDirectory;
    NativeSaveBridge(File filesDirectory) { saveDirectory = new File(filesDirectory, "saves"); }

    @JavascriptInterface public String transact(String requestJson) {
        JSONObject response = new JSONObject();
        try {
            JSONObject request = new JSONObject(requestJson);
            String requestId = request.getString("requestId");
            String operation = request.getString("operation");
            response.put("schemaVersion", 1).put("requestId", requestId).put("operation", operation);
            if (!requestId.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,79}")) throw new IllegalArgumentException("Invalid request id");
            if (!operation.equals("mirror.write") && !operation.equals("mirror.read")) return error(response, "unavailable", "Document picker operations are not enabled in this scaffold.");
            String slot = request.getString("slotId");
            if (!slot.matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,79}")) throw new IllegalArgumentException("Invalid slot id");
            if (!saveDirectory.exists() && !saveDirectory.mkdirs()) return error(response, "write-failed", "Save directory could not be created.");
            File target = new File(saveDirectory, slot + ".json");
            if (operation.equals("mirror.write")) {
                String payload = request.getString("payload");
                byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > MAX_BYTES) return error(response, "payload-too-large", "Save payload exceeds one MiB.");
                File temporary = new File(saveDirectory, slot + ".tmp");
                try (FileOutputStream output = new FileOutputStream(temporary)) {
                    output.write(bytes);
                    output.getFD().sync();
                }
                if (target.exists() && !target.delete()) return error(response, "write-failed", "Old save could not be replaced.");
                if (!temporary.renameTo(target)) return error(response, "write-failed", "Atomic save replacement failed.");
                return response.put("status", "ok").toString();
            }
            if (!target.isFile()) return response.put("status", "cancelled").put("errorCode", "cancelled").put("message", "No mirrored save exists.").toString();
            if (target.length() > MAX_BYTES) return error(response, "payload-too-large", "Stored save exceeds one MiB.");
            byte[] bytes = new byte[(int) target.length()];
            int offset = 0;
            try (FileInputStream input = new FileInputStream(target)) {
                while (offset < bytes.length) {
                    int read = input.read(bytes, offset, bytes.length - offset);
                    if (read < 0) break;
                    offset += read;
                }
            }
            if (offset != bytes.length) return error(response, "read-failed", "Stored save could not be read completely.");
            return response.put("status", "ok").put("payload", new String(bytes, StandardCharsets.UTF_8)).toString();
        } catch (Exception error) {
            try { return error(response, "invalid-request", "Native save request was rejected."); }
            catch (Exception ignored) { return "{\"schemaVersion\":1,\"requestId\":\"invalid\",\"operation\":\"mirror.read\",\"status\":\"error\",\"errorCode\":\"invalid-request\"}"; }
        }
    }

    private static String error(JSONObject response, String code, String message) throws Exception {
        return response.put("status", "error").put("errorCode", code).put("message", message).toString();
    }
}
