package com.sentinelcve.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.TeamsNotificationConfig;
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
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Java port of server.ts lines 1346-1416.
 */
@RestController
@RequestMapping("/api/teams")
public class TeamsConfigController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public TeamsConfigController(AppState state, StateService stateService, LogService logService, ObjectMapper objectMapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        synchronized (state.lock) {
            return ResponseEntity.ok(state.teamsConfig);
        }
    }

    @PutMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody(required = false) Map<String, Object> body) throws Exception {
        Map<String, Object> request = body != null ? body : Map.of();
        TeamsNotificationConfig response;
        synchronized (state.lock) {
            objectMapper.updateValue(state.teamsConfig, request);
            response = state.teamsConfig;
        }
        logService.addLog("SYSTEM_INFO", "INFO",
            "更新 Microsoft Teams 通知設定: 頻道 [" + state.teamsConfig.getChannelName() + "]",
            "MS Teams Notification");
        stateService.persist();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/test")
    public ResponseEntity<?> testTeams(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        TeamsNotificationConfig config;
        synchronized (state.lock) {
            config = copyConfig(state.teamsConfig);
        }

        String targetUrl = firstNonBlank(asString(request.get("webhookUrl")), config.getWebhookUrl());
        String targetChannel = firstNonBlank(asString(request.get("channelName")), config.getChannelName());

        LinkedHashMap<String, Object> section = new LinkedHashMap<>();
        section.put("activityTitle", "✅ SentinelCVE 資安監控系統 - Teams 頻道連線測試");
        section.put("activitySubtitle", "通報頻道: " + targetChannel);
        section.put("facts", List.of(
            fact("系統狀態", "🟢 運作正常 (Online)"),
            fact("頻道名稱", targetChannel),
            fact("測試時間", DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM).withLocale(Locale.forLanguageTag("zh-TW"))
                .format(java.time.ZonedDateTime.now(ZoneId.systemDefault()))),
            fact("觸發門檻", "CVSS >= " + config.getMinCvssScore())
        ));
        section.put("markdown", true);
        section.put("text", "這是一封來自 **SentinelCVE 漏洞資安監控與預警系統** 的 Microsoft Teams Webhook 通報測試卡片。若您看到此訊息，代表 Teams 即時推播管道設定已順利生效！");

        LinkedHashMap<String, Object> teamsPayload = new LinkedHashMap<>();
        teamsPayload.put("@type", "MessageCard");
        teamsPayload.put("@context", "http://schema.org/extensions");
        teamsPayload.put("themeColor", "2563EB");
        teamsPayload.put("summary", "🎉 SentinelCVE Microsoft Teams 通報連線測試成功");
        teamsPayload.put("sections", List.of(section));

        if (!hasHttpUrl(targetUrl)) {
            return ResponseEntity.badRequest().body(errorBody(false, "請提供有效的 Teams Webhook URL。"));
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(targetUrl))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(teamsPayload)))
                .build();
            HttpResponse<String> teamsResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (teamsResponse.statusCode() / 100 != 2) {
                throw new RuntimeException("Teams Webhook 回傳 HTTP " + teamsResponse.statusCode());
            }

            logService.addLog("WEBHOOK_DISPATCH", "SUCCESS",
                "[MS Teams 測試] 測試訊息已成功推播至 Teams 頻道: " + targetChannel,
                "MS Teams Notification");

            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("channelName", targetChannel);
            response.put("sentAt", Instant.now().toString());
            response.put("message", "Microsoft Teams 測試卡片已成功送出至「" + targetChannel + "」！");
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            logService.addLog("WEBHOOK_DISPATCH", "ERROR",
                "[MS Teams 測試失敗]: " + safeMessage(err, "連線逾時或 URL 錯誤"),
                "MS Teams Notification");
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("channelName", targetChannel);
            response.put("sentAt", Instant.now().toString());
            response.put("error", safeMessage(err, "Teams Webhook 連線失敗"));
            return ResponseEntity.status(502).body(response);
        }
    }

    private TeamsNotificationConfig copyConfig(TeamsNotificationConfig source) {
        TeamsNotificationConfig config = new TeamsNotificationConfig();
        config.setWebhookUrl(source.getWebhookUrl());
        config.setChannelName(source.getChannelName());
        config.setEnabled(source.isEnabled());
        config.setMinCvssScore(source.getMinCvssScore());
        config.setNotifyCisaKevOnly(source.isNotifyCisaKevOnly());
        config.setBotDisplayName(source.getBotDisplayName());
        return config;
    }

    private LinkedHashMap<String, String> fact(String name, String value) {
        LinkedHashMap<String, String> map = new LinkedHashMap<>();
        map.put("name", name);
        map.put("value", value);
        return map;
    }

    private LinkedHashMap<String, Object> errorBody(boolean success, String error) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", success);
        body.put("error", error);
        return body;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private static boolean hasHttpUrl(String value) {
        return value != null && value.matches("(?i)^https?://.*");
    }

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
