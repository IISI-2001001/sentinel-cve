package com.sentinelcve.controller;

import com.sentinelcve.model.AiConfig;
import com.sentinelcve.service.AiService;
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

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Java port of server.ts lines 725-782.
 */
@RestController
@RequestMapping("/api/ai")
public class AiConfigController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final AiService aiService;

    public AiConfigController(AppState state, StateService stateService, LogService logService, AiService aiService) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.aiService = aiService;
    }

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        synchronized (state.lock) {
            return ResponseEntity.ok(publicAiConfig(state.currentAiConfig));
        }
    }

    @PutMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> updates = body != null ? body : Map.of();
        AiConfig response;
        synchronized (state.lock) {
            AiConfig config = state.currentAiConfig;
            if (hasText(updates.get("provider"))) config.setProvider(asString(updates.get("provider")));
            if (hasText(updates.get("model"))) config.setModel(asString(updates.get("model")));
            if (hasText(updates.get("apiKey"))) config.setApiKey(asString(updates.get("apiKey")));
            if (updates.containsKey("baseUrl")) config.setBaseUrl(asString(updates.get("baseUrl")));
            if (updates.containsKey("awsRegion")) config.setAwsRegion(asString(updates.get("awsRegion")));
            if (hasText(updates.get("awsAccessKeyId")) && !"configured".equals(asString(updates.get("awsAccessKeyId")))) {
                config.setAwsAccessKeyId(asString(updates.get("awsAccessKeyId")));
            }
            if (hasText(updates.get("awsSecretAccessKey"))) config.setAwsSecretAccessKey(asString(updates.get("awsSecretAccessKey")));
            if (hasText(updates.get("awsSessionToken"))) config.setAwsSessionToken(asString(updates.get("awsSessionToken")));
            if (updates.containsKey("temperature")) config.setTemperature(toNumber(updates.get("temperature")));
            if (hasText(updates.get("promptPreset"))) config.setPromptPreset(asString(updates.get("promptPreset")));
            if (updates.containsKey("customSystemPrompt")) config.setCustomSystemPrompt(asString(updates.get("customSystemPrompt")));
            response = publicAiConfig(config);
        }

        logService.addLog("SYSTEM_INFO", "INFO",
            "變更 AI 設定: 提供商 [" + state.currentAiConfig.getProvider() + "] - 模型 [" + state.currentAiConfig.getModel() + "]",
            "AI Engine");
        stateService.persist();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/test")
    public ResponseEntity<?> testConfig(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        AiConfig testConfig;
        synchronized (state.lock) {
            testConfig = state.currentAiConfig.copy();
        }
        if (request.containsKey("provider")) testConfig.setProvider(asString(request.get("provider")));
        if (request.containsKey("model")) testConfig.setModel(asString(request.get("model")));
        if (request.containsKey("baseUrl")) testConfig.setBaseUrl(asString(request.get("baseUrl")));
        if (request.containsKey("awsRegion")) testConfig.setAwsRegion(asString(request.get("awsRegion")));
        if (request.containsKey("temperature")) testConfig.setTemperature(toNumber(request.get("temperature")));
        if (request.containsKey("promptPreset")) testConfig.setPromptPreset(asString(request.get("promptPreset")));
        if (request.containsKey("customSystemPrompt")) testConfig.setCustomSystemPrompt(asString(request.get("customSystemPrompt")));

        if (hasText(request.get("apiKey"))) testConfig.setApiKey(asString(request.get("apiKey")));
        Object awsAccessKeyId = request.get("awsAccessKeyId");
        if ("configured".equals(asString(awsAccessKeyId))) {
            synchronized (state.lock) {
                testConfig.setAwsAccessKeyId(state.currentAiConfig.getAwsAccessKeyId());
            }
        } else if (hasText(awsAccessKeyId)) {
            testConfig.setAwsAccessKeyId(asString(awsAccessKeyId));
        }
        if (hasText(request.get("awsSecretAccessKey"))) testConfig.setAwsSecretAccessKey(asString(request.get("awsSecretAccessKey")));
        if (hasText(request.get("awsSessionToken"))) testConfig.setAwsSessionToken(asString(request.get("awsSessionToken")));

        try {
            String reply = aiService.generateAiText("請以一句繁體中文回應：SentinelCVE AI 連線測試成功。", testConfig, false);
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("provider", testConfig.getProvider());
            response.put("modelUsed", testConfig.getModel());
            response.put("message", reply);
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            return ResponseEntity.status(502).body(errorBody(false, safeMessage(err, "AI 連線發生異常")));
        }
    }

    private AiConfig publicAiConfig(AiConfig source) {
        AiConfig config = source.copy();
        config.setApiKey("");
        config.setAwsAccessKeyId(hasText(source.getAwsAccessKeyId()) ? "configured" : "");
        config.setAwsSecretAccessKey("");
        config.setAwsSessionToken("");
        return config;
    }

    private LinkedHashMap<String, Object> errorBody(boolean success, String error) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", success);
        body.put("error", error);
        return body;
    }

    private static boolean hasText(Object value) {
        return value != null && !String.valueOf(value).isEmpty();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static double toNumber(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        if (value == null || String.valueOf(value).isBlank()) return 0;
        return Double.parseDouble(String.valueOf(value));
    }

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
