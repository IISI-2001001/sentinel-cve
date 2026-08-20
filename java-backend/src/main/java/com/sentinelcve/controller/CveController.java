package com.sentinelcve.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.AiAnalysis;
import com.sentinelcve.model.AiConfig;
import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.service.AiService;
import com.sentinelcve.service.AlertRuleEngineService;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.ScanService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Java port of server.ts lines 1540-1669.
 */
@RestController
public class CveController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ScanService scanService;
    private final AlertRuleEngineService alertRuleEngineService;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    public CveController(AppState state, StateService stateService, LogService logService, ScanService scanService,
                         AlertRuleEngineService alertRuleEngineService, AiService aiService, ObjectMapper objectMapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.scanService = scanService;
        this.alertRuleEngineService = alertRuleEngineService;
        this.aiService = aiService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/api/cves")
    public ResponseEntity<?> getCves(@RequestParam(required = false) String query,
                                     @RequestParam(required = false) String severity,
                                     @RequestParam(required = false) String cisaKevOnly) {
        List<CveItem> results;
        synchronized (state.lock) {
            results = new ArrayList<>(state.cvesDatabase);
        }

        if (query != null && !query.trim().isEmpty()) {
            String q = query.toLowerCase(Locale.ROOT).trim();
            results = results.stream().filter(c ->
                safeLower(c.getId()).contains(q)
                    || safeLower(c.getTitle()).contains(q)
                    || safeLower(c.getProductName()).contains(q)
                    || safeLower(c.getDescription()).contains(q)
            ).toList();
        }
        if (severity != null && !"ALL".equals(severity)) {
            results = results.stream().filter(c -> c.getCvss() != null && severity.equals(c.getCvss().getSeverity())).toList();
        }
        if ("true".equals(cisaKevOnly)) {
            results = results.stream().filter(CveItem::isCisaKev).toList();
        }

        return ResponseEntity.ok(results);
    }

    @GetMapping("/api/cves/search")
    public ResponseEntity<?> searchCves(@RequestParam(name = "q", required = false) String q) {
        String query = (q == null || q.isBlank()) ? "linux" : q;
        return ResponseEntity.ok(scanService.searchCVEsFromSource(query));
    }

    @PostMapping("/api/cves/scan")
    public ResponseEntity<?> scan(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        String productId = asString(request.get("productId"));

        int totalAlertsTriggered = 0;
        List<String> scannedProductNames = new ArrayList<>();
        List<Map<String, String>> errors = new ArrayList<>();

        List<MonitoredProduct> targetProds;
        synchronized (state.lock) {
            targetProds = hasText(productId)
                ? state.products.stream().filter(p -> productId.equals(p.getId())).toList()
                : state.products.stream().filter(MonitoredProduct::isAutoScanEnabled).toList();
        }

        for (MonitoredProduct prod : targetProds) {
            try {
                List<CveItem> found = scanService.scanProductFromVerifiedSources(prod);
                scannedProductNames.add(prod.getName());
                for (CveItem cve : found) totalAlertsTriggered += alertRuleEngineService.evaluateAlertRules(cve, prod);
            } catch (Exception err) {
                LinkedHashMap<String, String> error = new LinkedHashMap<>();
                error.put("productId", prod.getId());
                error.put("productName", prod.getName());
                error.put("error", safeMessage(err, "掃描失敗"));
                errors.add(error);
            }
        }

        logService.addLog(
            "MANUAL_SCAN",
            errors.isEmpty() ? "SUCCESS" : "WARNING",
            "全盤監控掃描完成 " + scannedProductNames.size() + " 項、失敗 " + errors.size() + " 項",
            String.join(", ", scannedProductNames),
            "觸發新警報: " + totalAlertsTriggered + " 則"
        );
        stateService.persist();

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("scannedCount", scannedProductNames.size());
        response.put("alertsTriggered", totalAlertsTriggered);
        response.put("scannedProducts", scannedProductNames);
        response.put("errors", errors);
        response.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/cve/ai-assess")
    public ResponseEntity<?> aiAssess(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        String cveId = asString(request.get("cveId"));

        CveItem stateCve;
        synchronized (state.lock) {
            stateCve = state.cvesDatabase.stream().filter(c -> cveId != null && cveId.equals(c.getId())).findFirst().orElse(null);
        }
        CveItem cve = stateCve != null ? stateCve : request.containsKey("cveData")
            ? objectMapper.convertValue(request.get("cveData"), CveItem.class)
            : null;

        if (cve == null) {
            return ResponseEntity.status(404).body(error("CVE record not found"));
        }

        AiConfig currentConfig;
        synchronized (state.lock) {
            currentConfig = state.currentAiConfig.copy();
        }
        String rolePrompt = "你是一位資深企業資安架構師與 SOC (Security Operations Center) 威脅分析專家。";
        if ("redteam".equals(currentConfig.getPromptPreset())) {
            rolePrompt = "你是一位頂尖紅隊攻擊專家與滲透測試工程師，專注於分析概念驗證 (PoC) 攻擊鏈與漏洞突破路徑。";
        } else if ("compliance".equals(currentConfig.getPromptPreset())) {
            rolePrompt = "你是一位資安合規與內部稽核顧問，專注於分析 ISO 27001、NIST CSF 合規標準與監管風控要求。";
        } else if ("custom".equals(currentConfig.getPromptPreset()) && hasText(currentConfig.getCustomSystemPrompt())) {
            rolePrompt = currentConfig.getCustomSystemPrompt();
        }

        String prompt = rolePrompt + "\n請針對以下 CVE 漏洞進行深度威脅剖析與資安處置建議：\n\n"
            + "[漏洞資訊]\n"
            + "- CVE 編號: " + cve.getId() + "\n"
            + "- 標題: " + cve.getTitle() + "\n"
            + "- 受影響產品: " + cve.getProductName() + " (廠商: " + cve.getVendorName() + ")\n"
            + "- CVSS v3.1 評分: " + (cve.getCvss() != null ? cve.getCvss().getBaseScore() : null) + " ("
            + (cve.getCvss() != null ? cve.getCvss().getSeverity() : null) + ")\n"
            + "- CVSS Vector: " + (cve.getCvss() != null ? cve.getCvss().getVectorString() : null) + "\n"
            + "- CISA Known Exploited (已在網路遭攻擊): " + (cve.isCisaKev() ? "是 (急迫危機)" : "否") + "\n"
            + "- 漏洞描述: " + cve.getDescription() + "\n\n"
            + "請輸出 JSON 格式 (繁體中文)，結構如下：\n"
            + "{\n"
            + "  \"summary\": \"1-2 句精簡專業的漏洞核心風險概述\",\n"
            + "  \"impactLevel\": \"CRITICAL\" | \"HIGH\" | \"MEDIUM\" | \"LOW\",\n"
            + "  \"attackScenario\": \"攻擊者具體攻擊路徑與潛在後果 (例如如何取得遠端執行權限或提權)\",\n"
            + "  \"mitigationSteps\": [\"具體修補步驟1 (如升級版本)\", \"具體修補步驟2 (如關閉特定設定或服務)\", \"網絡層阻斷建議\"],\n"
            + "  \"workaround\": \"如果無法立即重啟升級時的臨時應變規避措施 (Workaround)\",\n"
            + "  \"executiveAdvisory\": \"給企業高階資安主管 (CISO) 或維運團隊的緊急行動指引與影響範疇\"\n"
            + "}";

        try {
            String activeModel = hasText(currentConfig.getModel()) ? currentConfig.getModel() : "gemini-3.6-flash";
            String aiText = aiService.generateAiText(prompt, currentConfig, true);
            AiAnalysis analysis = objectMapper.readValue(aiText, AiAnalysis.class);
            analysis.setAnalyzedAt(Instant.now().toString());
            if (stateCve != null) {
                synchronized (state.lock) {
                    stateCve.setAiAnalysis(analysis);
                }
            } else {
                cve.setAiAnalysis(analysis);
            }

            logService.addLog("AI_ANALYSIS", "SUCCESS",
                "完成 AI [" + currentConfig.getProvider() + "/" + activeModel + "] 漏洞剖析: " + cve.getId(),
                cve.getProductName());
            if (stateCve != null) stateService.persist();
            return ResponseEntity.ok(analysis);
        } catch (Exception err) {
            logService.addLog("AI_ANALYSIS", "ERROR",
                "AI 漏洞剖析失敗: " + cve.getId() + " - " + safeMessage(err, "未知錯誤"),
                cve.getProductName());
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("error", safeMessage(err, "AI 漏洞剖析失敗"));
            return ResponseEntity.status(502).body(response);
        }
    }

    private LinkedHashMap<String, Object> error(String message) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return body;
    }

    private static String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
