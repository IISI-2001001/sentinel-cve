package com.sentinelcve.service;

import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.model.Project;
import com.sentinelcve.state.AppState;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/** Java port of the `setInterval(..., 30000)` background worker at the bottom of
 * startServer() in server.ts: checks project notification clocks, the global schedule
 * config, and each product's individual auto-scan interval every 30 seconds. */
@Service
public class SchedulerService {

    private final AppState state;
    private final LogService logService;
    private final ScanService scanService;
    private final AlertRuleEngineService alertRuleEngineService;
    private final ProjectDigestService projectDigestService;

    public SchedulerService(AppState state, LogService logService, ScanService scanService,
                             AlertRuleEngineService alertRuleEngineService, ProjectDigestService projectDigestService) {
        this.state = state;
        this.logService = logService;
        this.scanService = scanService;
        this.alertRuleEngineService = alertRuleEngineService;
        this.projectDigestService = projectDigestService;
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    public void tick() {
        long now = System.currentTimeMillis();

        List<Project> projectsSnapshot;
        synchronized (state.lock) {
            projectsSnapshot = List.copyOf(state.projects);
        }
        for (Project project : projectsSnapshot) {
            if (!Boolean.FALSE.equals(project.getVersionNotifyEnabled())) {
                long next = project.getVersionNotifyNextRunAt() != null ? Instant.parse(project.getVersionNotifyNextRunAt()).toEpochMilli() : 0;
                if (next == 0 || now >= next) {
                    try {
                        projectDigestService.dispatchProjectDigest(project, "VERSION", false);
                    } catch (Exception err) {
                        logService.addLog("WEBHOOK_DISPATCH", "ERROR", "[版本排程通知失敗] " + project.getName() + ": " + safeMessage(err), project.getName());
                    }
                }
            }
            if (!Boolean.FALSE.equals(project.getCveNotifyEnabled())) {
                long next = project.getCveNotifyNextRunAt() != null ? Instant.parse(project.getCveNotifyNextRunAt()).toEpochMilli() : 0;
                if (next == 0 || now >= next) {
                    try {
                        projectDigestService.dispatchProjectDigest(project, "CVE", false);
                    } catch (Exception err) {
                        logService.addLog("WEBHOOK_DISPATCH", "ERROR", "[CVE 排程通知失敗] " + project.getName() + ": " + safeMessage(err), project.getName());
                    }
                }
            }
        }

        boolean scheduleEnabled;
        String nextRunAt;
        synchronized (state.lock) {
            scheduleEnabled = state.scheduleConfig.isEnabled();
            nextRunAt = state.scheduleConfig.getNextRunAt();
        }
        if (scheduleEnabled && nextRunAt != null) {
            long nextRunTime = Instant.parse(nextRunAt).toEpochMilli();
            if (now >= nextRunTime) {
                synchronized (state.lock) {
                    state.scheduleConfig.setLastRunAt(Instant.now().toString());
                    state.scheduleConfig.setNextRunAt(Instant.ofEpochMilli(now + state.scheduleConfig.getIntervalMinutes() * 60_000L).toString());
                }
                logService.addLog("AUTO_SCAN", "INFO", "[排程自動觸發] 啟動全域自動定期資安掃描 (頻率: " + state.scheduleConfig.getIntervalMinutes() + " 分鐘)", "Auto Scheduler");

                List<MonitoredProduct> targetProds;
                synchronized (state.lock) {
                    targetProds = "CRITICAL_HIGH_ONLY".equals(state.scheduleConfig.getScanScope())
                        ? state.products.stream().filter(p -> "CRITICAL".equals(p.getCriticality()) || "HIGH".equals(p.getCriticality())).toList()
                        : List.copyOf(state.products);
                }

                int totalAlerts = 0;
                for (MonitoredProduct prod : targetProds) {
                    try {
                        List<com.sentinelcve.model.CveItem> found = scanService.scanProductFromVerifiedSources(prod);
                        prod.setDetectedCveCount(found.size());
                        prod.setLastScannedAt(Instant.now().toString());
                        for (var cve : found) totalAlerts += alertRuleEngineService.evaluateAlertRules(cve, prod);
                    } catch (Exception err) {
                        // Scheduled scan failure for a single product should not abort the batch.
                    }
                }
                logService.addLog("AUTO_SCAN", "SUCCESS", "[排程自動觸發] 全域自動掃描完成，已巡檢 " + targetProds.size() + " 項資產", "Auto Scheduler",
                    "觸發警報: " + totalAlerts + " 則");
            }
        }

        List<MonitoredProduct> productsSnapshot;
        synchronized (state.lock) {
            productsSnapshot = List.copyOf(state.products);
        }
        for (MonitoredProduct prod : productsSnapshot) {
            if (!prod.isAutoScanEnabled()) continue;
            long lastScanTime = prod.getLastScannedAt() != null ? Instant.parse(prod.getLastScannedAt()).toEpochMilli() : 0;
            long intervalMs = prod.getScanIntervalMinutes() * 60_000L;
            if (now - lastScanTime >= intervalMs) {
                prod.setLastScannedAt(Instant.now().toString());
                logService.addLog("AUTO_SCAN", "INFO", "系統定期自動背景掃描產品: " + prod.getName(), prod.getName());
                try {
                    List<com.sentinelcve.model.CveItem> found = scanService.scanProductFromVerifiedSources(prod);
                    prod.setDetectedCveCount(found.size());
                    for (var cve : found) alertRuleEngineService.evaluateAlertRules(cve, prod);
                } catch (Exception err) {
                    // Auto-scan failure for a single product should not abort the loop.
                }
            }
        }
    }

    private static String safeMessage(Exception err) {
        return err.getMessage() != null ? err.getMessage() : "未知錯誤";
    }
}
