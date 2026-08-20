package com.sentinelcve.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.model.Project;
import com.sentinelcve.provider.ProductProviderService;
import com.sentinelcve.state.AppState;
import lombok.Data;
import org.springframework.stereotype.Service;

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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/** Java port of dispatchProjectDigest() in server.ts: sends a Teams-webhook digest of either
 * pending version updates ("VERSION") or newly-relevant CVEs ("CVE") for a project, honoring
 * per-kind notification frequency, signature-based de-duplication, and closed-ticket exclusion. */
@Service
public class ProjectDigestService {

    private final AppState state;
    private final LogService logService;
    private final StateService stateService;
    private final AlertRuleEngineService alertRuleEngineService;
    private final ProductProviderService productProviderService;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public ProjectDigestService(AppState state, LogService logService, StateService stateService,
                                 AlertRuleEngineService alertRuleEngineService, ProductProviderService productProviderService,
                                 ObjectMapper mapper) {
        this.state = state;
        this.logService = logService;
        this.stateService = stateService;
        this.alertRuleEngineService = alertRuleEngineService;
        this.productProviderService = productProviderService;
        this.mapper = mapper;
    }

    @Data
    public static class DigestResult {
        private int sent;
        private int recipients;
    }

    private static long frequencyMs(String frequency) {
        String f = frequency != null ? frequency : "DAILY";
        return switch (f) {
            case "REALTIME" -> 60_000L;
            case "EVERY_15_MIN" -> 15 * 60_000L;
            case "HOURLY" -> 60 * 60_000L;
            case "DAILY" -> 24 * 60 * 60_000L;
            case "WEEKLY" -> 7 * 24 * 60 * 60_000L;
            default -> 24 * 60 * 60_000L;
        };
    }

    public DigestResult dispatchProjectDigest(Project project, String kind, boolean force) throws Exception {
        List<MonitoredProduct> projectProducts;
        synchronized (state.lock) {
            projectProducts = state.products.stream().filter(p -> project.getProductIds().contains(p.getId())).toList();
        }
        Instant now = Instant.now();
        boolean isVersion = "VERSION".equals(kind);
        String frequency = isVersion
            ? (project.getVersionNotifyFrequency() != null ? project.getVersionNotifyFrequency() : "DAILY")
            : (project.getCveNotifyFrequency() != null ? project.getCveNotifyFrequency()
                : (project.getNotifyFrequency() != null ? project.getNotifyFrequency() : "REALTIME"));

        if (isVersion) {
            project.setVersionNotifyLastRunAt(now.toString());
            project.setVersionNotifyNextRunAt(now.plusMillis(frequencyMs(frequency)).toString());
        } else {
            project.setCveNotifyLastRunAt(now.toString());
            project.setCveNotifyNextRunAt(now.plusMillis(frequencyMs(frequency)).toString());
        }

        if (isVersion) {
            long sourceRefreshMs = 15 * 60_000L;
            for (MonitoredProduct product : projectProducts) {
                long checkedAt = product.getVersionCheckedAt() != null ? Instant.parse(product.getVersionCheckedAt()).toEpochMilli() : 0;
                if (!force && checkedAt > 0 && now.toEpochMilli() - checkedAt < sourceRefreshMs) continue;
                try {
                    var result = productProviderService.getLatestVersion(product);
                    applyVersionResult(product, result);
                } catch (Exception err) {
                    logService.addLog("SYSTEM_INFO", "ERROR", "產品【" + product.getName() + "】排程版本檢查失敗: " + safeMessage(err), product.getName());
                }
            }
        }

        List<MonitoredProduct> versionItems = projectProducts.stream()
            .filter(p -> Boolean.TRUE.equals(p.getHasUpdateAvailable()) && !alertRuleEngineService.hasClosedVersionTicket(project.getId(), p.getName()))
            .toList();
        List<CveItem> cveItems;
        synchronized (state.lock) {
            cveItems = state.cvesDatabase.stream()
                .filter(c -> projectProducts.stream().anyMatch(p -> p.getName().equalsIgnoreCase(c.getProductName())))
                .filter(c -> c.getCvss().getBaseScore() >= project.getNotifyMinCvss())
                .filter(c -> !project.isNotifyCisaKevOnly() || c.isCisaKev())
                .filter(c -> !alertRuleEngineService.hasClosedCveTicket(project.getId(), c.getId()))
                .toList();
        }

        DigestResult empty = new DigestResult();
        List<?> items = isVersion ? versionItems : cveItems;
        if (items.isEmpty()) {
            stateService.persist();
            return empty;
        }

        String deliveredSignature;
        if (isVersion) {
            String signature = versionItems.stream().map(p -> p.getId() + ":" + p.getLatestSecureVersion()).sorted().reduce((a, b) -> a + "|" + b).orElse("");
            if (!force && signature.equals(project.getVersionNotifyLastSignature())) {
                stateService.persist();
                return empty;
            }
            deliveredSignature = signature;
        } else {
            String signature = cveItems.stream()
                .map(c -> c.getId() + ":" + c.getProductName() + ":" + c.getCvss().getBaseScore() + ":" + (c.getLastModifiedDate() != null ? c.getLastModifiedDate() : ""))
                .sorted().reduce((a, b) -> a + "|" + b).orElse("");
            if (!force && signature.equals(project.getCveNotifyLastSignature())) {
                stateService.persist();
                return empty;
            }
            deliveredSignature = signature;
        }

        String subject = isVersion ? "[SentinelCVE] " + project.getName() + " 產品版本更新通知" : "[SentinelCVE] " + project.getName() + " CVE 弱點摘要";
        List<?> visibleItems = items.subList(0, Math.min(30, items.size()));

        List<ObjectNode> detailSections = new ArrayList<>();
        if (isVersion) {
            int i = 0;
            for (Object o : visibleItems) {
                MonitoredProduct p = (MonitoredProduct) o;
                ObjectNode section = mapper.createObjectNode();
                section.put("activityTitle", (++i) + ". " + p.getName());
                var facts = section.putArray("facts");
                addFact(facts, "目前版本", p.getCurrentVersion() != null ? p.getCurrentVersion() : "未設定");
                addFact(facts, "建議安全版本", p.getLatestSecureVersion() != null ? p.getLatestSecureVersion() : (p.getLatestVersion() != null ? p.getLatestVersion() : "尚無資料"));
                addFact(facts, "版本狀態", "⚠️ 建議評估升級");
                section.put("markdown", true);
                detailSections.add(section);
            }
        } else {
            int i = 0;
            for (Object o : visibleItems) {
                CveItem c = (CveItem) o;
                ObjectNode section = mapper.createObjectNode();
                section.put("activityTitle", (++i) + ". " + c.getId() + " — " + c.getProductName());
                var facts = section.putArray("facts");
                addFact(facts, "CVSS 分數", c.getCvss().getBaseScore() + " (" + c.getCvss().getSeverity() + ")");
                addFact(facts, "CISA KEV", c.isCisaKev() ? "⚠️ 是，已有在野利用" : "否");
                addFact(facts, "公開日期", c.getPublishedDate() != null ? formatDate(c.getPublishedDate()) : "未知");
                if (c.getTitle() != null) section.put("text", "**摘要：** " + c.getTitle());
                section.put("markdown", true);
                detailSections.add(section);
            }
        }

        ObjectNode headerSection = mapper.createObjectNode();
        headerSection.put("activityTitle", isVersion ? "📦 產品版本更新通知" : "🛡️ CVE 弱點通知");
        headerSection.put("activitySubtitle", "專案：" + project.getName() + " (" + project.getCode() + ")");
        var headerFacts = headerSection.putArray("facts");
        addFact(headerFacts, "通知類型", isVersion ? "版本更新" : "CVE 弱點");
        addFact(headerFacts, "本次項目", items.size() + " 項");
        if (!isVersion) addFact(headerFacts, "CVSS 門檻", "≥ " + project.getNotifyMinCvss());
        addFact(headerFacts, "發送時間", formatDateTime(now));
        headerSection.put("text", items.size() > visibleItems.size()
            ? "本訊息列出前 " + visibleItems.size() + " 項，其餘 " + (items.size() - visibleItems.size()) + " 項請回系統查看。"
            : "以下各項已分開顯示，便於閱讀與追蹤。");
        headerSection.put("markdown", true);

        LinkedHashSet<String> urls = new LinkedHashSet<>();
        if (project.getOwnerTeamsWebhookUrl() != null && !project.getOwnerTeamsWebhookUrl().isBlank()) urls.add(project.getOwnerTeamsWebhookUrl());
        else if (project.getTeamsWebhookUrl() != null && !project.getTeamsWebhookUrl().isBlank()) urls.add(project.getTeamsWebhookUrl());
        if (project.getHandlerTeamsWebhookUrl() != null && !project.getHandlerTeamsWebhookUrl().isBlank()) urls.add(project.getHandlerTeamsWebhookUrl());

        if (urls.isEmpty()) {
            logService.addLog("WEBHOOK_DISPATCH", "WARNING", "[專案通知略過] 專案【" + project.getName() + "】未設定 Teams Webhook", project.getName());
            stateService.persist();
            return empty;
        }

        ObjectNode payload = mapper.createObjectNode();
        payload.put("@type", "MessageCard");
        payload.put("@context", "http://schema.org/extensions");
        payload.put("themeColor", isVersion ? "2563EB" : "DC2626");
        payload.put("summary", subject);
        var sections = payload.putArray("sections");
        sections.add(headerSection);
        detailSections.forEach(sections::add);

        for (String url : urls) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(15)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString())).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) throw new RuntimeException("Teams Webhook 回傳 HTTP " + response.statusCode());
        }

        if (isVersion) project.setVersionNotifyLastSignature(deliveredSignature);
        else project.setCveNotifyLastSignature(deliveredSignature);

        logService.addLog("WEBHOOK_DISPATCH", "SUCCESS",
            "[" + (isVersion ? "版本" : "CVE") + "排程通知] 專案【" + project.getName() + "】彙整 " + items.size() + " 項，頻率 " + frequency,
            project.getName());
        stateService.persist();

        DigestResult result = new DigestResult();
        result.setSent(items.size());
        result.setRecipients(urls.size());
        return result;
    }

    public void applyVersionResult(MonitoredProduct product, ProductProviderService.VersionResult result) {
        product.setLatestVersion(result.getLatestVersion());
        product.setLatestSecureVersion(result.getLatestSecureVersion());
        product.setHasUpdateAvailable(product.getCurrentVersion() != null && !product.getCurrentVersion().isBlank()
            && !result.getLatestSecureVersion().equals(product.getCurrentVersion()));
        product.setLatestReleaseDate(result.getReleaseDate());
        product.setUpdateNotes(result.getNotes());
        product.setSourceType(productProviderService.resolveSourceType(product));
        product.setVersionSourceUrl(result.getSourceUrl());
        product.setVersionCheckedAt(result.getCheckedAt());
        product.setVersionConfidence(result.getConfidence());
        product.setLastScannedAt(result.getCheckedAt());
    }

    private void addFact(com.fasterxml.jackson.databind.node.ArrayNode facts, String name, String value) {
        ObjectNode f = mapper.createObjectNode();
        f.put("name", name);
        f.put("value", value);
        facts.add(f);
    }

    private static String formatDate(String iso) {
        try {
            return DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM).withLocale(Locale.TAIWAN)
                .withZone(ZoneId.systemDefault()).format(Instant.parse(iso));
        } catch (Exception e) {
            return iso;
        }
    }

    private static String formatDateTime(Instant instant) {
        return DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM).withLocale(Locale.TAIWAN)
            .withZone(ZoneId.systemDefault()).format(instant);
    }

    static String safeMessage(Exception err) {
        return err.getMessage() != null ? err.getMessage() : "未知錯誤";
    }
}
