package com.sentinelcve.controller;

import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.model.ScheduleConfig;
import com.sentinelcve.service.AlertRuleEngineService;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.ScanService;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of server.ts lines 1285-1345.
 */
@RestController
@RequestMapping("/api/schedule")
public class ScheduleConfigController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ScanService scanService;
    private final AlertRuleEngineService alertRuleEngineService;

    public ScheduleConfigController(AppState state, StateService stateService, LogService logService,
                                    ScanService scanService, AlertRuleEngineService alertRuleEngineService) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.scanService = scanService;
        this.alertRuleEngineService = alertRuleEngineService;
    }

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        synchronized (state.lock) {
            return ResponseEntity.ok(state.scheduleConfig);
        }
    }

    @PutMapping("/config")
    public ResponseEntity<?> updateConfig(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        ScheduleConfig response;
        synchronized (state.lock) {
            if (request.containsKey("enabled")) state.scheduleConfig.setEnabled(jsBoolean(request.get("enabled")));
            if (request.containsKey("intervalMinutes")) state.scheduleConfig.setIntervalMinutes((int) toNumber(request.get("intervalMinutes")));
            if (hasText(request.get("cronExpression"))) state.scheduleConfig.setCronExpression(asString(request.get("cronExpression")));
            if (hasText(request.get("scanScope"))) state.scheduleConfig.setScanScope(asString(request.get("scanScope")));
            if (request.containsKey("autoAiAnalysis")) state.scheduleConfig.setAutoAiAnalysis(jsBoolean(request.get("autoAiAnalysis")));
            if (request.containsKey("autoNotifyTeams")) state.scheduleConfig.setAutoNotifyTeams(jsBoolean(request.get("autoNotifyTeams")));
            if (request.containsKey("autoNotifyEmail")) state.scheduleConfig.setAutoNotifyEmail(jsBoolean(request.get("autoNotifyEmail")));
            state.scheduleConfig.setNextRunAt(Instant.ofEpochMilli(System.currentTimeMillis() + state.scheduleConfig.getIntervalMinutes() * 60_000L).toString());
            response = state.scheduleConfig;
        }

        logService.addLog("SYSTEM_INFO", "INFO",
            "更新系統自動排程設定: 頻率 " + state.scheduleConfig.getIntervalMinutes() + " 分鐘 / 範圍 [" + state.scheduleConfig.getScanScope() + "]",
            "Auto Scheduler");
        stateService.persist();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/run-now")
    public ResponseEntity<?> runNow() {
        String lastRunAt;
        String nextRunAt;
        List<MonitoredProduct> targetProds;
        synchronized (state.lock) {
            Instant now = Instant.now();
            state.scheduleConfig.setLastRunAt(now.toString());
            state.scheduleConfig.setNextRunAt(Instant.ofEpochMilli(now.toEpochMilli() + state.scheduleConfig.getIntervalMinutes() * 60_000L).toString());
            lastRunAt = state.scheduleConfig.getLastRunAt();
            nextRunAt = state.scheduleConfig.getNextRunAt();
            targetProds = "CRITICAL_HIGH_ONLY".equals(state.scheduleConfig.getScanScope())
                ? state.products.stream().filter(p -> "CRITICAL".equals(p.getCriticality()) || "HIGH".equals(p.getCriticality())).toList()
                : List.copyOf(state.products);
        }

        int scannedCount = 0;
        int alertsTriggered = 0;
        List<Map<String, String>> scanErrors = new ArrayList<>();
        for (MonitoredProduct prod : targetProds) {
            try {
                List<CveItem> found = scanService.scanProductFromVerifiedSources(prod);
                scannedCount++;
                for (CveItem cve : found) {
                    alertsTriggered += alertRuleEngineService.evaluateAlertRules(cve, prod);
                }
            } catch (Exception err) {
                LinkedHashMap<String, String> error = new LinkedHashMap<>();
                error.put("productId", prod.getId());
                error.put("productName", prod.getName());
                error.put("error", safeMessage(err, "掃描失敗"));
                scanErrors.add(error);
            }
        }

        logService.addLog("AUTO_SCAN", scanErrors.isEmpty() ? "SUCCESS" : "WARNING",
            "[排程手動觸發] 完成 " + scannedCount + " 項、失敗 " + scanErrors.size() + " 項",
            "Auto Scheduler",
            "新增警報: " + alertsTriggered + " 則");
        stateService.persist();

        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("scannedCount", scannedCount);
        response.put("alertsTriggered", alertsTriggered);
        response.put("errors", scanErrors);
        response.put("lastRunAt", lastRunAt);
        response.put("nextRunAt", nextRunAt);
        response.put("message", "手動觸發排程掃描完成！共掃描 " + scannedCount + " 項資產產品。");
        return ResponseEntity.ok(response);
    }

    private static boolean hasText(Object value) {
        return value != null && !String.valueOf(value).isBlank();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static boolean jsBoolean(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.doubleValue() != 0;
        if (value instanceof String s) return !s.isEmpty();
        return true;
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
