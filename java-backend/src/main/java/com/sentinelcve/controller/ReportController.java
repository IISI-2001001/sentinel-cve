package com.sentinelcve.controller;

import com.sentinelcve.model.AiConfig;
import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.service.AiService;
import com.sentinelcve.service.LogService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Java port of server.ts lines 1670-1733.
 */
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final AppState state;
    private final LogService logService;
    private final AiService aiService;

    public ReportController(AppState state, LogService logService, AiService aiService) {
        this.state = state;
        this.logService = logService;
        this.aiService = aiService;
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody(required = false) Map<String, Object> body) {
        try {
            Map<String, Object> request = body != null ? body : Map.of();
            String timeframe = request.get("timeframe") != null ? String.valueOf(request.get("timeframe")) : "最近 7 天";

            List<MonitoredProduct> products;
            List<CveItem> cvesDatabase;
            AiConfig currentAiConfig;
            synchronized (state.lock) {
                products = new ArrayList<>(state.products);
                cvesDatabase = new ArrayList<>(state.cvesDatabase);
                currentAiConfig = state.currentAiConfig.copy();
            }

            String monitoredNames = products.stream()
                .map(p -> p.getName() + " (" + p.getCategory() + ")")
                .reduce((a, b) -> a + ", " + b)
                .orElse("");
            String highRiskCves = cvesDatabase.stream()
                .filter(c -> c.getCvss() != null && c.getCvss().getBaseScore() >= 7.0)
                .limit(5)
                .map(c -> "- [" + c.getId() + "] " + c.getProductName() + ": CVSS " + c.getCvss().getBaseScore()
                    + " (" + (c.isCisaKev() ? "CISA KEV攻擊中" : "高風險") + ") - " + c.getTitle())
                .reduce((a, b) -> a + "\n" + b)
                .orElse("");

            String activeModel = hasText(currentAiConfig.getModel()) ? currentAiConfig.getModel() : "gemini-3.6-flash";
            String prompt = "你是一位企業級 Chief Information Security Officer (CISO) 資安顧問。\n"
                + "請根據以下監控數據，撰寫一份高階「資安威脅與 CVE 漏洞即時監控報告」(" + timeframe + ")：\n\n"
                + "[監控資產清單]\n" + monitoredNames + "\n\n"
                + "[近期高危漏洞發現 (CVSS >= 7.0)]\n" + highRiskCves + "\n\n"
                + "請以繁體中文 Markdown 格式輸出，包含以下章節：\n"
                + "1. 📊 Executive Summary (高階摘要與整體資安風險指數 0-100)\n"
                + "2. 🚨 核心威脅與關鍵 CVE 漏洞剖析 (重點說明最危險的 2-3 個漏洞)\n"
                + "3. 🛡️ 建議優先處置行動清單 (按緊急程度排序：24小時內/7天內/30天內)\n"
                + "4. 📈 資安防禦戰略與監控優化建議";

            AiConfig reportConfig = currentAiConfig.copy();
            if (reportConfig.getTemperature() == 0.0) reportConfig.setTemperature(0.3);
            String reportText = aiService.generateAiText(prompt, reportConfig, false);

            LinkedHashMap<String, Object> report = new LinkedHashMap<>();
            report.put("id", "rep-" + System.currentTimeMillis());
            report.put("generatedAt", java.time.Instant.now().toString());
            report.put("timeframe", timeframe);
            report.put("title", "SentinelCVE 企業資安威脅週報 ("
                + LocalDate.now(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("yyyy/M/d", Locale.forLanguageTag("zh-TW"))) + ")");
            report.put("executiveSummary", reportText);
            report.put("topThreats", cvesDatabase.stream().limit(3).map(c -> {
                LinkedHashMap<String, Object> threat = new LinkedHashMap<>();
                threat.put("cveId", c.getId());
                threat.put("product", c.getProductName());
                threat.put("cvss", c.getCvss() != null ? c.getCvss().getBaseScore() : null);
                threat.put("description", c.getTitle());
                threat.put("status", c.isCisaKev() ? "被積極利用中" : "待修補");
                return threat;
            }).toList());
            report.put("overallRiskScore", 78);
            report.put("recommendedActions", List.of(
                "立即修補 Linux Kernel CVE-2024-3094 供應鏈後門漏洞。",
                "更新 Docker Engine 與 runC 防止容器逃逸 (CVE-2024-21626)。",
                "針對 Log4j 設定 WAF 阻斷規則並排查舊版 JAR 檔。"
            ));
            report.put("affectedProductsCount", products.stream().filter(p -> p.getActiveAlertCount() > 0).count());
            report.put("totalCveAnalyzed", cvesDatabase.size());

            logService.addLog("AI_ANALYSIS", "SUCCESS",
                "生成 AI [" + currentAiConfig.getProvider() + "/" + activeModel + "] 資安威脅監控報告",
                "全系統");
            return ResponseEntity.ok(report);
        } catch (Exception err) {
            return ResponseEntity.status(500).body(error("Failed to generate report"));
        }
    }

    private LinkedHashMap<String, Object> error(String message) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return body;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
