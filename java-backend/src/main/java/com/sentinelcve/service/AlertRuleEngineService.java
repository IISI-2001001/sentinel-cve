package com.sentinelcve.service;

import com.sentinelcve.model.AlertNotification;
import com.sentinelcve.model.AlertRule;
import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.state.AppState;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/** Java port of alert rule matching / dedup / notification dispatch. */
@Service
public class AlertRuleEngineService {

    private final AppState state;
    private final LogService logService;
    private final WebhookDispatchService webhookDispatchService;

    public AlertRuleEngineService(AppState state, LogService logService,
                                  WebhookDispatchService webhookDispatchService) {
        this.state = state;
        this.logService = logService;
        this.webhookDispatchService = webhookDispatchService;
    }

    public boolean hasClosedVersionTicket(String projectId, String productName) {
        synchronized (state.lock) {
            return state.tickets.stream().anyMatch(t ->
                projectId.equals(t.getProjectId())
                    && "CLOSED".equals(t.getStatus())
                    && (t.getCveList() == null || t.getCveList().isEmpty())
                    && t.getAffectedProducts() != null
                    && t.getAffectedProducts().stream().anyMatch(name -> name.equalsIgnoreCase(productName)));
        }
    }

    public boolean hasClosedCveTicket(String projectId, String cveId) {
        synchronized (state.lock) {
            return state.tickets.stream().anyMatch(t ->
                projectId.equals(t.getProjectId())
                    && "CLOSED".equals(t.getStatus())
                    && t.getCveList() != null
                    && t.getCveList().stream().anyMatch(c -> c.getCveId().equalsIgnoreCase(cveId)));
        }
    }

    /** Returns the number of new AlertNotifications created. */
    public int evaluateAlertRules(CveItem cve, MonitoredProduct product) {
        return evaluateAlertRules(cve, product.getId(), product.getName(), () -> product.setActiveAlertCount(product.getActiveAlertCount() + 1));
    }

    /** Per-project-binding overload: same rule matching/dedup/dispatch logic as the global
     * MonitoredProduct version, but scoped to a single project's product binding (see
     * ScanService#scanProjectBinding), incrementing the binding's own activeAlertCount. */
    public int evaluateAlertRules(CveItem cve, com.sentinelcve.model.ProjectProductBinding binding) {
        return evaluateAlertRules(cve, binding.getProductId(), binding.getProductName(),
            () -> binding.setActiveAlertCount(binding.getActiveAlertCount() + 1));
    }

    private int evaluateAlertRules(CveItem cve, String productId, String productName, Runnable onAlertCreated) {
        int createdCount = 0;
        java.util.List<AlertRule> rulesSnapshot;
        synchronized (state.lock) {
            rulesSnapshot = new java.util.ArrayList<>(state.rules);
        }

        for (AlertRule rule : rulesSnapshot) {
            if (!rule.isEnabled()) continue;
            if (rule.getTargetProductIds() != null && !rule.getTargetProductIds().isEmpty()
                && !rule.getTargetProductIds().contains(productId)) continue;
            if (cve.getCvss().getBaseScore() < rule.getMinCvssScore()) continue;
            if (rule.isOnlyCisaKev() && !cve.isCisaKev()) continue;

            AlertNotification created = null;
            synchronized (state.lock) {
                boolean exists = state.notifications.stream()
                    .anyMatch(n -> n.getCveId().equals(cve.getId()) && n.getProductName().equals(productName));
                if (!exists) {
                    AlertNotification newNotif = new AlertNotification();
                    newNotif.setId("notif-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4));
                    newNotif.setCveId(cve.getId());
                    newNotif.setCveTitle(cve.getTitle());
                    newNotif.setProductName(productName);
                    newNotif.setCvssScore(cve.getCvss().getBaseScore());
                    newNotif.setSeverity(cve.getCvss().getSeverity());
                    newNotif.setCisaKev(cve.isCisaKev());
                    newNotif.setMessage("在監控產品【" + productName + "】中發現 CVSS " + cve.getCvss().getBaseScore()
                        + " 漏洞 (" + cve.getId() + ")，觸發警報規則【" + rule.getName() + "】。");
                    newNotif.setRuleName(rule.getName());
                    newNotif.setStatus("UNREAD");
                    newNotif.setTimestamp(Instant.now().toString());
                    newNotif.setChannelDispatched(rule.getNotifyChannels().stream()
                        .map(c -> "in_app".equals(c) ? "In-App Badge" : "webhook".equals(c) ? "Webhook" : "Email").toList());

                    state.notifications.add(0, newNotif);
                    onAlertCreated.run();
                    created = newNotif;
                }
            }

            if (created != null) {
                createdCount++;
                logService.addLog("ALERT_TRIGGER", "WARNING", "觸發即時警報: " + cve.getId() + " (" + productName + ")",
                    productName, "規則: " + rule.getName());

                if (rule.getNotifyChannels().contains("webhook")) {
                    java.util.List<com.sentinelcve.model.WebhookConfig> enabledWebhooks;
                    synchronized (state.lock) {
                        enabledWebhooks = state.webhooks.stream().filter(com.sentinelcve.model.WebhookConfig::isEnabled).toList();
                    }
                    for (var wh : enabledWebhooks) {
                        webhookDispatchService.dispatchWebhook(wh, created);
                    }
                }
            }
        }
        return createdCount;
    }
}
