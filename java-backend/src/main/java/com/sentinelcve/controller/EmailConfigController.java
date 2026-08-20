package com.sentinelcve.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.EmailNotificationConfig;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.MailService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of server.ts lines 1245-1284.
 */
@RestController
@RequestMapping("/api/email")
public class EmailConfigController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final MailService mailService;
    private final ObjectMapper objectMapper;

    public EmailConfigController(AppState state, StateService stateService, LogService logService,
                                 MailService mailService, ObjectMapper objectMapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.mailService = mailService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        synchronized (state.lock) {
            return ResponseEntity.ok(publicEmailConfig(state.emailConfig));
        }
    }

    @PutMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody(required = false) Map<String, Object> body) throws Exception {
        Map<String, Object> request = body != null ? body : Map.of();
        EmailNotificationConfig response;
        synchronized (state.lock) {
            LinkedHashMap<String, Object> safeUpdates = new LinkedHashMap<>(request);
            safeUpdates.remove("password");
            objectMapper.updateValue(state.emailConfig, safeUpdates);
            if (hasText(request.get("password"))) {
                state.emailConfig.setPassword(String.valueOf(request.get("password")));
            }
            response = publicEmailConfig(state.emailConfig);
        }
        logService.addLog("SYSTEM_INFO", "INFO",
            "更新 Email SMTP 通報伺服器設定: " + state.emailConfig.getSmtpServer() + ":" + state.emailConfig.getSmtpPort(),
            "Email Notification");
        stateService.persist();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/test")
    public ResponseEntity<?> testEmail(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        EmailNotificationConfig config;
        synchronized (state.lock) {
            config = copyEmailConfig(state.emailConfig);
        }

        List<String> recipients = config.getDefaultRecipients();
        String targetEmail = firstNonBlank(
            asString(request.get("testEmail")),
            asString(request.get("testRecipient")),
            recipients != null && !recipients.isEmpty() ? recipients.get(0) : null,
            config.getSenderEmail()
        );
        String targetName = firstNonBlank(asString(request.get("recipientName")), "專案負責人");

        if (!hasText(config.getSmtpServer()) || !hasText(config.getSenderEmail()) || !hasText(targetEmail)) {
            return ResponseEntity.badRequest().body(errorBody(false, "請先設定 SMTP 主機、寄件者與測試收件者。"));
        }

        try {
            mailService.sendMail(
                config,
                targetEmail,
                "SentinelCVE SMTP 連線測試",
                "SentinelCVE SMTP 測試成功。測試時間：" + Instant.now().toString()
            );
            logService.addLog("WEBHOOK_DISPATCH", "SUCCESS",
                "[Email Engine] SMTP 測試信件發送成功: " + targetName + " <" + targetEmail + ">",
                "Email Notification");

            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("sentTo", targetEmail);
            response.put("timestamp", Instant.now().toString());
            response.put("message", "測試電子郵件已成功派送至 " + targetEmail);
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            logService.addLog("WEBHOOK_DISPATCH", "ERROR",
                "[Email Engine] SMTP 測試失敗: " + safeMessage(err, "連線失敗"),
                "Email Notification");
            return ResponseEntity.status(502).body(errorBody(false, safeMessage(err, "SMTP 連線或寄送失敗")));
        }
    }

    private EmailNotificationConfig publicEmailConfig(EmailNotificationConfig source) {
        EmailNotificationConfig config = copyEmailConfig(source);
        config.setPassword("");
        return config;
    }

    private EmailNotificationConfig copyEmailConfig(EmailNotificationConfig source) {
        EmailNotificationConfig config = new EmailNotificationConfig();
        config.setSmtpServer(source.getSmtpServer());
        config.setSmtpPort(source.getSmtpPort());
        config.setSenderName(source.getSenderName());
        config.setSenderEmail(source.getSenderEmail());
        config.setEnableAuth(source.isEnableAuth());
        config.setUsername(source.getUsername());
        config.setPassword(source.getPassword());
        config.setDefaultRecipients(source.getDefaultRecipients());
        return config;
    }

    private LinkedHashMap<String, Object> errorBody(boolean success, String error) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", success);
        body.put("error", error);
        return body;
    }

    private static boolean hasText(Object value) {
        return value != null && !String.valueOf(value).isBlank();
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

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
