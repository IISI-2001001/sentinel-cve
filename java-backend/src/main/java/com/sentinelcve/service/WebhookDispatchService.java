package com.sentinelcve.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sentinelcve.model.AlertNotification;
import com.sentinelcve.model.WebhookConfig;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;

/** Java port of dispatchWebhook() in server.ts (Slack / Microsoft Teams / generic JSON POST). */
@Service
public class WebhookDispatchService {

    private final ObjectMapper mapper;
    private final LogService logService;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public WebhookDispatchService(ObjectMapper mapper, LogService logService) {
        this.mapper = mapper;
        this.logService = logService;
    }

    private HttpResponse<String> postJson(String url, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(15))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    public void dispatchWebhook(WebhookConfig webhook, AlertNotification alert) {
        try {
            if (webhook.getUrl() == null || !(webhook.getUrl().startsWith("http://") || webhook.getUrl().startsWith("https://"))) {
                throw new RuntimeException("不合法的 Webhook URL 協定");
            }

            HttpResponse<String> response;
            if ("slack".equals(webhook.getType())) {
                ObjectNode payload = mapper.createObjectNode();
                payload.put("text", "🚨 *[資安警報] 發現重大漏洞: " + alert.getCveId() + " (" + alert.getSeverity() + ")*");
                ObjectNode attachment = mapper.createObjectNode();
                attachment.put("color", "CRITICAL".equals(alert.getSeverity()) ? "#dc2626" : "HIGH".equals(alert.getSeverity()) ? "#ea580c" : "#eab308");
                var fields = attachment.putArray("fields");
                addField(fields, "產品名稱", alert.getProductName(), true);
                addField(fields, "CVSS 評分", alert.getCvssScore() + " (" + alert.getSeverity() + ")", true);
                addField(fields, "CISA KEV 主動攻擊", alert.isCisaKev() ? "⚠️ 是 (已在網路上遭攻擊)" : "否", true);
                addField(fields, "觸發規則", alert.getRuleName(), true);
                addField(fields, "詳細資訊", alert.getMessage(), false);
                payload.putArray("attachments").add(attachment);
                response = postJson(webhook.getUrl(), payload.toString());
            } else if ("teams".equals(webhook.getType())) {
                ObjectNode payload = mapper.createObjectNode();
                payload.put("@type", "MessageCard");
                payload.put("@context", "http://schema.org/extensions");
                payload.put("themeColor", "CRITICAL".equals(alert.getSeverity()) ? "DC2626" : "HIGH".equals(alert.getSeverity()) ? "EA580C" : "EAB308");
                payload.put("summary", "🚨 SentinelCVE 漏洞警報: " + alert.getCveId() + " (" + alert.getSeverity() + ")");
                ObjectNode section = mapper.createObjectNode();
                section.put("activityTitle", "🚨 [SentinelCVE 漏洞警報] " + alert.getCveId());
                section.put("activitySubtitle", "產品: " + alert.getProductName() + " | 評分: CVSS " + alert.getCvssScore() + " (" + alert.getSeverity() + ")");
                var facts = section.putArray("facts");
                addFact(facts, "CVE 編號", alert.getCveId());
                addFact(facts, "受影響產品", alert.getProductName());
                addFact(facts, "CVSS 評分", alert.getCvssScore() + " (" + alert.getSeverity() + ")");
                addFact(facts, "CISA KEV 在野利用", alert.isCisaKev() ? "⚠️ 是 (已有網路攻擊行動)" : "否");
                addFact(facts, "觸發警報規則", alert.getRuleName());
                addFact(facts, "發生時間", alert.getTimestamp());
                section.put("markdown", true);
                section.put("text", alert.getMessage());
                payload.putArray("sections").add(section);
                response = postJson(webhook.getUrl(), payload.toString());
            } else {
                ObjectNode payload = mapper.createObjectNode();
                payload.put("event", "CVE_ALERT_TRIGGERED");
                payload.put("alertId", alert.getId());
                payload.put("cveId", alert.getCveId());
                payload.put("cveTitle", alert.getCveTitle());
                payload.put("product", alert.getProductName());
                payload.put("cvssScore", alert.getCvssScore());
                payload.put("severity", alert.getSeverity());
                payload.put("cisaKev", alert.isCisaKev());
                payload.put("ruleMatched", alert.getRuleName());
                payload.put("message", alert.getMessage());
                payload.put("timestamp", alert.getTimestamp());
                response = postJson(webhook.getUrl(), payload.toString());
            }

            if (response.statusCode() / 100 != 2) {
                throw new RuntimeException("Webhook 回傳 HTTP " + response.statusCode());
            }

            webhook.setLastTestedAt(Instant.now().toString());
            webhook.setLastStatus("SUCCESS");
            logService.addLog("WEBHOOK_DISPATCH", "SUCCESS", "成功推播 Webhook [" + webhook.getName() + "] (" + alert.getCveId() + ")", alert.getProductName());
        } catch (Exception err) {
            webhook.setLastTestedAt(Instant.now().toString());
            webhook.setLastStatus("FAILED");
            logService.addLog("WEBHOOK_DISPATCH", "ERROR", "Webhook 推播失敗 [" + webhook.getName() + "]: " + (err.getMessage() != null ? err.getMessage() : "網路請求失敗"), alert.getProductName());
        }
    }

    private void addField(com.fasterxml.jackson.databind.node.ArrayNode fields, String title, String value, boolean shortField) {
        ObjectNode f = mapper.createObjectNode();
        f.put("title", title);
        f.put("value", value);
        f.put("short", shortField);
        fields.add(f);
    }

    private void addFact(com.fasterxml.jackson.databind.node.ArrayNode facts, String name, String value) {
        ObjectNode f = mapper.createObjectNode();
        f.put("name", name);
        f.put("value", value);
        facts.add(f);
    }
}
