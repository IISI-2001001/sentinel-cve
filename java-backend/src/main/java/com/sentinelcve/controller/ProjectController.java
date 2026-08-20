package com.sentinelcve.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.model.Project;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.ProjectDigestService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.FormatStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/** Java port of server.ts lines 783-973. */
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ProjectDigestService projectDigestService;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public ProjectController(AppState state, StateService stateService, LogService logService,
                             ProjectDigestService projectDigestService, ObjectMapper mapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.projectDigestService = projectDigestService;
        this.mapper = mapper;
    }

    @GetMapping
    public List<Map<String, Object>> listProjects() {
        synchronized (state.lock) {
            List<Map<String, Object>> response = new ArrayList<>();
            for (Project prj : state.projects) {
                List<String> productIds = prj.getProductIds() != null ? prj.getProductIds() : List.of();
                List<MonitoredProduct> prjProducts = state.products.stream()
                    .filter(product -> productIds.contains(product.getId()))
                    .toList();
                int totalCves = prjProducts.stream().mapToInt(MonitoredProduct::getDetectedCveCount).sum();
                int totalAlerts = prjProducts.stream().mapToInt(MonitoredProduct::getActiveAlertCount).sum();

                LinkedHashMap<String, Object> item = mapper.convertValue(
                    prj, new TypeReference<LinkedHashMap<String, Object>>() {});
                item.put("productsList", prjProducts);
                item.put("totalCves", totalCves);
                item.put("totalAlerts", totalAlerts);
                response.add(item);
            }
            return response;
        }
    }

    @PostMapping
    public ResponseEntity<?> createProject(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = safeBody(body);
        String name = asString(payload.get("name"));
        if (name == null || name.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "專案名稱 (name) 為必填欄位。");
        }

        String notifyFrequency = nonBlank(asString(payload.get("notifyFrequency")), "REALTIME");
        String teamsWebhookUrl = nonBlank(asString(payload.get("teamsWebhookUrl")), "");
        String now = Instant.now().toString();

        Project newProject = new Project();
        newProject.setId("prj-" + System.currentTimeMillis());
        newProject.setCode(nonBlank(asString(payload.get("code")), "PRJ-" + ThreadLocalRandom.current().nextInt(100, 1000)));
        newProject.setName(name);
        newProject.setDescription(nonBlank(asString(payload.get("description")), ""));
        newProject.setDepartment(nonBlank(asString(payload.get("department")), "資訊技術部門"));
        newProject.setOwnerName(nonBlank(asString(payload.get("ownerName")), "未指定負責人"));
        newProject.setOwnerEmail(nonBlank(asString(payload.get("ownerEmail")), ""));
        newProject.setSecondaryContacts(toStringList(payload.get("secondaryContacts")));
        newProject.setProductIds(toStringList(payload.get("productIds")));
        newProject.setNotifyEmail(payload.containsKey("notifyEmail") ? truthy(payload.get("notifyEmail")) : true);
        newProject.setNotifyFrequency(notifyFrequency);
        newProject.setVersionNotifyEnabled(payload.containsKey("versionNotifyEnabled") ? truthy(payload.get("versionNotifyEnabled")) : true);
        newProject.setVersionNotifyFrequency(nonBlank(asString(payload.get("versionNotifyFrequency")), "DAILY"));
        newProject.setCveNotifyEnabled(payload.containsKey("cveNotifyEnabled") ? truthy(payload.get("cveNotifyEnabled")) : true);
        newProject.setCveNotifyFrequency(nonBlank(asString(payload.get("cveNotifyFrequency")), notifyFrequency));
        newProject.setTeamsWebhookUrl(teamsWebhookUrl);
        newProject.setOwnerTeamsWebhookUrl(nonBlank(asString(payload.get("ownerTeamsWebhookUrl")), teamsWebhookUrl));
        newProject.setHandlerName(nonBlank(asString(payload.get("handlerName")), ""));
        newProject.setHandlerTeamsWebhookUrl(nonBlank(asString(payload.get("handlerTeamsWebhookUrl")), ""));
        newProject.setNotifyMinCvss(numberOrDefault(payload.get("notifyMinCvss"), 7.0));
        newProject.setNotifyCisaKevOnly(truthy(payload.get("notifyCisaKevOnly")));
        newProject.setCreatedAt(now);
        newProject.setUpdatedAt(now);

        synchronized (state.lock) {
            state.projects.add(newProject);
        }

        logService.addLog(
            "SYSTEM_INFO",
            "INFO",
            "建立新專案: " + newProject.getName() + " (代號: " + newProject.getCode() + ")",
            newProject.getName(),
            "負責人: " + newProject.getOwnerName() + " <" + newProject.getOwnerEmail() + ">"
        );
        stateService.persist();
        return ResponseEntity.ok(newProject);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProject(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = safeBody(body);
        Project project;
        synchronized (state.lock) {
            project = state.projects.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
            if (project == null) {
                return error(HttpStatus.NOT_FOUND, "專案不存在");
            }
            try {
                mapper.updateValue(project, payload);
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
            project.setUpdatedAt(Instant.now().toString());
        }

        logService.addLog(
            "SYSTEM_INFO",
            "INFO",
            "更新專案資訊與通報頻率: " + project.getName(),
            project.getName(),
            "版本: " + nonBlank(project.getVersionNotifyFrequency(), "DAILY")
                + " / CVE: " + nonBlank(project.getCveNotifyFrequency(), nonBlank(project.getNotifyFrequency(), "REALTIME"))
        );
        stateService.persist();
        return ResponseEntity.ok(project);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> deleteProject(@PathVariable String id) {
        Project removed = null;
        synchronized (state.lock) {
            int idx = -1;
            for (int i = 0; i < state.projects.size(); i++) {
                if (id.equals(state.projects.get(i).getId())) {
                    idx = i;
                    break;
                }
            }
            if (idx != -1) {
                removed = state.projects.remove(idx);
            }
        }

        if (removed != null) {
            logService.addLog("SYSTEM_INFO", "INFO", "刪除專案: " + removed.getName(), removed.getName());
            stateService.persist();
        }
        return success(true);
    }

    @PostMapping("/{id}/notify-teams-test")
    public ResponseEntity<?> notifyTeamsTest(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        Project prj;
        synchronized (state.lock) {
            prj = state.projects.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
        }
        if (prj == null) {
            return error(HttpStatus.NOT_FOUND, "專案不存在");
        }

        Map<String, Object> payload = safeBody(body);
        String webhookType = "handler".equals(asString(payload.get("webhookType"))) ? "handler" : "owner";
        String webhookUrl = nonBlank(asString(payload.get("webhookUrl")),
            "handler".equals(webhookType)
                ? prj.getHandlerTeamsWebhookUrl()
                : nonBlank(prj.getOwnerTeamsWebhookUrl(), prj.getTeamsWebhookUrl()));
        if (webhookUrl == null || webhookUrl.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "專案未設定 Teams Webhook URL");
        }

        try {
            ObjectNode teamsPayload = mapper.createObjectNode();
            teamsPayload.put("@type", "MessageCard");
            teamsPayload.put("@context", "http://schema.org/extensions");
            teamsPayload.put("themeColor", "2563EB");
            teamsPayload.put("summary", "🔔 [SentinelCVE] 專案「" + prj.getName() + "」Teams 通報測試");

            ObjectNode section = mapper.createObjectNode();
            section.put("activityTitle", "🔔 [SentinelCVE 測試通報] 專案: " + prj.getName());
            section.put("activitySubtitle", "專案代號: " + prj.getCode() + " | 頻率設定: " + nonBlank(prj.getNotifyFrequency(), "REALTIME"));
            ArrayNode facts = section.putArray("facts");
            addFact(facts, "專案名稱", prj.getName());
            addFact(facts, "handler".equals(webhookType) ? "處理人" : "負責人",
                "handler".equals(webhookType) ? nonBlank(prj.getHandlerName(), "未指定") : prj.getOwnerName());
            addFact(facts, "通知頻率", nonBlank(prj.getNotifyFrequency(), "REALTIME (即時)"));
            addFact(facts, "測試時間", DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM)
                .withLocale(Locale.TAIWAN)
                .withZone(ZoneId.systemDefault())
                .format(Instant.now()));
            section.put("markdown", true);
            section.put("text", "這是一則來自 **SentinelCVE 資安監控平台** 的測試通報，確認專案【" + prj.getName() + "】的 Microsoft Teams 頻道連線正常。");
            teamsPayload.putArray("sections").add(section);

            HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(teamsPayload.toString()))
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new RuntimeException("Teams Webhook 回傳 HTTP " + response.statusCode());
            }

            logService.addLog("WEBHOOK_DISPATCH", "SUCCESS",
                "專案「" + prj.getName() + "」Teams 測試訊息已成功推送",
                prj.getName(),
                "Webhook URL: " + webhookUrl);
            LinkedHashMap<String, Object> responseBody = new LinkedHashMap<>();
            responseBody.put("success", true);
            responseBody.put("message", "已成功推送測試訊息至專案 Teams 頻道！");
            return ResponseEntity.ok(responseBody);
        } catch (Exception err) {
            logService.addLog("WEBHOOK_DISPATCH", "ERROR",
                "專案「" + prj.getName() + "」Teams 測試推送失敗: " + safeMessage(err),
                prj.getName());
            return error(HttpStatus.INTERNAL_SERVER_ERROR, safeMessage(err, "推送至 Teams Webhook 失敗"));
        }
    }

    @PostMapping("/{id}/notify-version-now")
    public ResponseEntity<?> notifyVersionNow(@PathVariable String id) {
        Project project;
        synchronized (state.lock) {
            project = state.projects.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
        }
        if (project == null) {
            return error(HttpStatus.NOT_FOUND, "專案不存在");
        }
        if (isBlank(project.getOwnerTeamsWebhookUrl()) && isBlank(project.getTeamsWebhookUrl()) && isBlank(project.getHandlerTeamsWebhookUrl())) {
            return error(HttpStatus.BAD_REQUEST, "請先設定負責人或處理人的 Teams Webhook。");
        }

        try {
            ProjectDigestService.DigestResult result = projectDigestService.dispatchProjectDigest(project, "VERSION", true);
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("sent", result.getSent());
            response.put("recipients", result.getRecipients());
            response.put("message", result.getSent() > 0
                ? "已手動發送 " + result.getSent() + " 項版本更新至 " + result.getRecipients() + " 個 Teams Webhook。"
                : "目前沒有需要通知的版本更新。");
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            return error(HttpStatus.BAD_GATEWAY, safeMessage(err, "版本通知發送失敗"));
        }
    }

    @PostMapping("/{id}/notify-cve-now")
    public ResponseEntity<?> notifyCveNow(@PathVariable String id) {
        Project project;
        synchronized (state.lock) {
            project = state.projects.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
        }
        if (project == null) {
            return error(HttpStatus.NOT_FOUND, "專案不存在");
        }
        if (isBlank(project.getOwnerTeamsWebhookUrl()) && isBlank(project.getTeamsWebhookUrl()) && isBlank(project.getHandlerTeamsWebhookUrl())) {
            return error(HttpStatus.BAD_REQUEST, "請先設定負責人或處理人的 Teams Webhook。");
        }

        try {
            ProjectDigestService.DigestResult result = projectDigestService.dispatchProjectDigest(project, "CVE", true);
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("sent", result.getSent());
            response.put("recipients", result.getRecipients());
            response.put("message", result.getSent() > 0
                ? "已手動發送 " + result.getSent() + " 項 CVE 至 " + result.getRecipients() + " 個 Teams Webhook。"
                : "目前沒有符合 CVSS／CISA KEV 條件的 CVE。");
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            return error(HttpStatus.BAD_GATEWAY, safeMessage(err, "CVE 通知發送失敗"));
        }
    }

    @PostMapping("/{id}/notify-test")
    public ResponseEntity<?> notifyTest(@PathVariable String id) {
        Project prj;
        List<String> productNames = new ArrayList<>();
        synchronized (state.lock) {
            prj = state.projects.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
            if (prj != null) {
                List<String> productIds = prj.getProductIds() != null ? prj.getProductIds() : List.of();
                productNames = state.products.stream()
                    .filter(product -> productIds.contains(product.getId()))
                    .map(MonitoredProduct::getName)
                    .toList();
            }
        }
        if (prj == null) {
            return error(HttpStatus.NOT_FOUND, "專案不存在");
        }

        String recipient = prj.getOwnerEmail();
        logService.addLog(
            "WEBHOOK_DISPATCH",
            "SUCCESS",
            "[Email 派送] 發送專案漏洞預警郵件至負責人: " + prj.getOwnerName() + " <" + recipient + ">",
            prj.getName(),
            "包含產品: " + String.join(", ", productNames)
        );

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("recipient", recipient);
        response.put("ownerName", prj.getOwnerName());
        response.put("projectName", prj.getName());
        response.put("sentAt", Instant.now().toString());
        response.put("emailSubject", "[SentinelCVE 緊急通報] 專案「" + prj.getName() + "」漏洞影響風險通知");
        response.put("message", "已派發測試預警郵件至專案負責人信箱: " + prj.getOwnerName() + " <" + recipient + ">");
        return ResponseEntity.ok(response);
    }

    private void addFact(ArrayNode facts, String name, String value) {
        ObjectNode fact = mapper.createObjectNode();
        fact.put("name", name);
        fact.put("value", value != null ? value : "");
        facts.add(fact);
    }

    private static Map<String, Object> safeBody(Map<String, Object> body) {
        return body != null ? body : Map.of();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean truthy(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean bool) return bool;
        if (value instanceof Number number) return number.doubleValue() != 0.0d;
        if (value instanceof String str) return !str.isEmpty();
        return true;
    }

    private static double numberOrDefault(Object value, double fallback) {
        if (value == null) return fallback;
        try {
            double parsed = value instanceof Number number ? number.doubleValue() : Double.parseDouble(String.valueOf(value));
            return parsed == 0.0d ? fallback : parsed;
        } catch (Exception ex) {
            return fallback;
        }
    }

    private static List<String> toStringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return new ArrayList<>();
        }
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            result.add(String.valueOf(item));
        }
        return result;
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        return error(status, message, "error");
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message, String key) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put(key, message);
        return ResponseEntity.status(status).body(body);
    }

    private static Map<String, Object> success(boolean success) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", success);
        return body;
    }

    private static String safeMessage(Exception err) {
        return safeMessage(err, "未知錯誤");
    }

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
