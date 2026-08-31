package com.sentinelcve.controller;

import com.sentinelcve.model.NvdApiConfig;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Manages the NVD (National Vulnerability Database) REST API key used by
 * {@code ProductProviderService} and {@code ScanService} when calling
 * services.nvd.nist.gov. Falls back to the NVD_API_KEY environment variable when no key has
 * been saved here yet, so existing deployments keep working without any UI changes. */
@RestController
@RequestMapping("/api/nvd")
public class NvdConfigController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public NvdConfigController(AppState state, StateService stateService, LogService logService) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
    }

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        synchronized (state.lock) {
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("apiKey", state.nvdApiConfig.getApiKey());
            response.put("updatedAt", state.nvdApiConfig.getUpdatedAt());
            response.put("usingEnvFallback", isBlank(state.nvdApiConfig.getApiKey()) && !isBlank(System.getenv("NVD_API_KEY")));
            return ResponseEntity.ok(response);
        }
    }

    @PutMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        NvdApiConfig response;
        synchronized (state.lock) {
            if (request.containsKey("apiKey")) {
                Object rawKey = request.get("apiKey");
                state.nvdApiConfig.setApiKey(rawKey == null ? null : String.valueOf(rawKey).trim());
            }
            state.nvdApiConfig.setUpdatedAt(Instant.now().toString());
            response = state.nvdApiConfig;
        }
        logService.addLog("SYSTEM_INFO", "INFO",
            isBlank(response.getApiKey()) ? "已清除 NVD API Key（將以匿名方式呼叫 NVD API）" : "已更新 NVD API Key",
            "NVD API 設定");
        stateService.persist();
        return ResponseEntity.ok(response);
    }

    /** Verifies the (saved or ad-hoc) key against a lightweight NVD lookup and reports back
     * whether NVD accepted it, plus the standard rate-limit headers when present. */
    @PostMapping("/test")
    public ResponseEntity<?> testApiKey(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        String candidateKey;
        synchronized (state.lock) {
            Object override = request.get("apiKey");
            candidateKey = (override != null && !String.valueOf(override).isBlank())
                ? String.valueOf(override).trim()
                : state.nvdApiConfig.getApiKey();
        }
        if (isBlank(candidateKey)) candidateKey = System.getenv("NVD_API_KEY");

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(
                    URI.create("https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2021-44228"))
                .timeout(Duration.ofSeconds(15))
                .header("User-Agent", "SentinelCVE/1.0")
                .GET();
            if (!isBlank(candidateKey)) builder.header("apiKey", candidateKey);
            HttpResponse<String> nvdResponse = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

            boolean success = nvdResponse.statusCode() / 100 == 2;
            response.put("success", success);
            response.put("usedApiKey", !isBlank(candidateKey));
            response.put("httpStatus", nvdResponse.statusCode());
            response.put("testedAt", Instant.now().toString());
            nvdResponse.headers().firstValue("x-ratelimit-limit").ifPresent(v -> response.put("rateLimitLimit", v));
            nvdResponse.headers().firstValue("x-ratelimit-remaining").ifPresent(v -> response.put("rateLimitRemaining", v));

            if (success) {
                response.put("message", !isBlank(candidateKey)
                    ? "NVD API Key 驗證成功，已可使用較高的呼叫速率上限。"
                    : "連線成功，但目前為匿名呼叫（未使用 API Key），速率上限較低。");
                logService.addLog("SYSTEM_INFO", "SUCCESS", "NVD API Key 測試連線成功", "NVD API 設定");
            } else if (nvdResponse.statusCode() == 403 || (nvdResponse.statusCode() == 404 && !isBlank(candidateKey))) {
                response.put("message", "NVD 回傳 HTTP " + nvdResponse.statusCode() + "，API Key 可能無效或已被拒絕，請確認 Key 是否正確。");
                logService.addLog("SYSTEM_INFO", "ERROR", "NVD API Key 測試失敗 (HTTP " + nvdResponse.statusCode() + "，Key 可能無效)", "NVD API 設定");
            } else {
                response.put("message", "NVD 回傳 HTTP " + nvdResponse.statusCode() + "，請稍後再試。");
                logService.addLog("SYSTEM_INFO", "ERROR", "NVD API Key 測試失敗 (HTTP " + nvdResponse.statusCode() + ")", "NVD API 設定");
            }
            return success ? ResponseEntity.ok(response) : ResponseEntity.status(502).body(response);
        } catch (Exception err) {
            response.put("success", false);
            response.put("usedApiKey", !isBlank(candidateKey));
            response.put("testedAt", Instant.now().toString());
            response.put("message", "連線 NVD API 失敗：" + safeMessage(err));
            logService.addLog("SYSTEM_INFO", "ERROR", "NVD API Key 測試失敗：" + safeMessage(err), "NVD API 設定");
            return ResponseEntity.status(502).body(response);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String safeMessage(Exception err) {
        return err.getMessage() != null ? err.getMessage() : err.getClass().getSimpleName();
    }
}
