package com.sentinelcve.service;

import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.model.Project;
import com.sentinelcve.model.ProjectProductBinding;
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
    private final CpeCacheService cpeCacheService;

    public SchedulerService(AppState state, LogService logService, ScanService scanService,
                             AlertRuleEngineService alertRuleEngineService, ProjectDigestService projectDigestService,
                             CpeCacheService cpeCacheService) {
        this.state = state;
        this.logService = logService;
        this.scanService = scanService;
        this.alertRuleEngineService = alertRuleEngineService;
        this.projectDigestService = projectDigestService;
        this.cpeCacheService = cpeCacheService;
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

                List<ProjectProductBinding> targetBindings = allEnabledBindings();

                int totalAlerts = 0;
                for (ProjectProductBinding binding : targetBindings) {
                    try {
                        List<com.sentinelcve.model.CveItem> found = scanService.scanProjectBinding(binding);
                        for (var cve : found) totalAlerts += alertRuleEngineService.evaluateAlertRules(cve, binding);
                    } catch (Exception err) {
                        // Scheduled scan failure for a single binding should not abort the batch.
                    }
                }
                logService.addLog("AUTO_SCAN", "SUCCESS", "[排程自動觸發] 全域自動掃描完成，已巡檢 " + targetBindings.size() + " 項資產", "Auto Scheduler",
                    "觸發警報: " + totalAlerts + " 則");
            }
        }

        boolean cpeUpdateEnabled;
        String cpeNextRunAt;
        synchronized (state.lock) {
            cpeUpdateEnabled = state.scheduleConfig.isCpeAutoUpdateEnabled();
            cpeNextRunAt = state.scheduleConfig.getCpeNextRunAt();
        }
        if (cpeUpdateEnabled) {
            long cpeNextRunTime = cpeNextRunAt != null ? Instant.parse(cpeNextRunAt).toEpochMilli() : 0;
            if (cpeNextRunTime == 0 || now >= cpeNextRunTime) {
                int intervalMinutes;
                synchronized (state.lock) {
                    intervalMinutes = state.scheduleConfig.getCpeUpdateIntervalMinutes() > 0
                        ? state.scheduleConfig.getCpeUpdateIntervalMinutes() : 1440;
                    state.scheduleConfig.setCpeLastRunAt(Instant.now().toString());
                    state.scheduleConfig.setCpeNextRunAt(Instant.ofEpochMilli(now + intervalMinutes * 60_000L).toString());
                }
                try {
                    cpeCacheService.refreshAllCachedCpe("排程自動觸發");
                } catch (Exception err) {
                    logService.addLog("SYSTEM_INFO", "ERROR", "[排程自動觸發] CPE 對照自動更新失敗: " + safeMessage(err), "CPE Auto Update");
                }
            }
        }

        // Per-binding auto-scan: each project's product binding may opt out (autoScanEnabled)
        // and set its own scanIntervalMinutes, mirroring the old per-MonitoredProduct behavior
        // but scoped to each project's specific product+version usage instead of a global list.
        List<ProjectProductBinding> bindingsSnapshot = allEnabledBindings();
        for (ProjectProductBinding binding : bindingsSnapshot) {
            long lastScanTime = binding.getLastScannedAt() != null ? Instant.parse(binding.getLastScannedAt()).toEpochMilli() : 0;
            long intervalMs = Math.max(binding.getScanIntervalMinutes(), 1) * 60_000L;
            if (now - lastScanTime >= intervalMs) {
                logService.addLog("AUTO_SCAN", "INFO", "系統定期自動背景掃描套用產品: " + binding.getProductName(), binding.getProductName());
                try {
                    List<com.sentinelcve.model.CveItem> found = scanService.scanProjectBinding(binding);
                    for (var cve : found) alertRuleEngineService.evaluateAlertRules(cve, binding);
                } catch (Exception err) {
                    // Auto-scan failure for a single binding should not abort the loop.
                }
            }
        }
    }

    /** Collects every project's product bindings that have autoScanEnabled (defaults true) across
     * all projects, since scanning is now performed per project-binding rather than per
     * globally-managed MonitoredProduct. */
    private List<ProjectProductBinding> allEnabledBindings() {
        synchronized (state.lock) {
            List<ProjectProductBinding> result = new java.util.ArrayList<>();
            for (Project project : state.projects) {
                if (project.getProductBindings() == null) continue;
                for (ProjectProductBinding binding : project.getProductBindings()) {
                    if (binding.isAutoScanEnabled()) result.add(binding);
                }
            }
            return result;
        }
    }

    private static String safeMessage(Exception err) {
        return err.getMessage() != null ? err.getMessage() : "未知錯誤";
    }
}
