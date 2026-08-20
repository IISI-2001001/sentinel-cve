package com.sentinelcve.controller;

import com.sentinelcve.model.AlertNotification;
import com.sentinelcve.model.WebhookConfig;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.service.WebhookDispatchService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of server.ts lines 1802-1856.
 */
@RestController
@RequestMapping("/api/webhooks")
public class WebhookController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final WebhookDispatchService webhookDispatchService;

    public WebhookController(AppState state, StateService stateService, LogService logService,
                             WebhookDispatchService webhookDispatchService) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.webhookDispatchService = webhookDispatchService;
    }

    @GetMapping
    public ResponseEntity<?> getWebhooks() {
        synchronized (state.lock) {
            return ResponseEntity.ok(new ArrayList<>(state.webhooks));
        }
    }

    @PostMapping
    public ResponseEntity<?> createWebhook(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        WebhookConfig newWh = new WebhookConfig();
        newWh.setId("wh-" + System.currentTimeMillis());
        newWh.setName(hasText(request.get("name")) ? String.valueOf(request.get("name")) : "Webhook Target");
        newWh.setType(hasText(request.get("type")) ? String.valueOf(request.get("type")) : "slack");
        newWh.setUrl(asString(request.get("url")));
        newWh.setEnabled(true);
        newWh.setSecretKey(asString(request.get("secretKey")));

        synchronized (state.lock) {
            state.webhooks.add(newWh);
        }
        logService.addLog("SYSTEM_INFO", "INFO", "新增 Webhook 頻道: " + newWh.getName());
        stateService.persist();
        return ResponseEntity.ok(newWh);
    }

    @PostMapping("/test")
    public ResponseEntity<?> testWebhook(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        WebhookConfig dummyWebhook = new WebhookConfig();
        dummyWebhook.setId("test-wh");
        dummyWebhook.setName(hasText(request.get("name")) ? String.valueOf(request.get("name")) : "Test Channel");
        dummyWebhook.setType(hasText(request.get("type")) ? String.valueOf(request.get("type")) : "slack");
        dummyWebhook.setUrl(hasText(request.get("url")) ? String.valueOf(request.get("url")) : "https://hooks.slack.com/services/test");
        dummyWebhook.setEnabled(true);

        AlertNotification dummyAlert = new AlertNotification();
        dummyAlert.setId("test-alert");
        dummyAlert.setCveId("CVE-2024-TEST");
        dummyAlert.setCveTitle("SentinelCVE 警報頻道連線測試範例");
        dummyAlert.setProductName("Sentinel Monitor Test");
        dummyAlert.setCvssScore(9.8);
        dummyAlert.setSeverity("CRITICAL");
        dummyAlert.setCisaKev(true);
        dummyAlert.setMessage("這是 SentinelCVE 資安監控系統發送的測試警報與 Webhook 連線驗證訊息。");
        dummyAlert.setRuleName("Webhook Connectivity Verification");
        dummyAlert.setStatus("UNREAD");
        dummyAlert.setTimestamp(Instant.now().toString());
        dummyAlert.setChannelDispatched(List.of("Webhook Test"));

        webhookDispatchService.dispatchWebhook(dummyWebhook, dummyAlert);

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", "SUCCESS".equals(dummyWebhook.getLastStatus()));
        response.put("status", dummyWebhook.getLastStatus());
        response.put("message", "SUCCESS".equals(dummyWebhook.getLastStatus())
            ? "Webhook 測試訊息已成功送出！"
            : "Webhook 送出失敗，請確認 URL 與網路設定。");
        return ResponseEntity.ok(response);
    }

    private static boolean hasText(Object value) {
        return value != null && !String.valueOf(value).isBlank();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
