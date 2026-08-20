package com.sentinelcve.controller;

import com.sentinelcve.model.AlertNotification;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;

/**
 * Java port of server.ts lines 1734-1760.
 */
@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;

    public AlertController(AppState state, StateService stateService, LogService logService) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
    }

    @GetMapping
    public ResponseEntity<?> getAlerts() {
        synchronized (state.lock) {
            return ResponseEntity.ok(new ArrayList<>(state.notifications));
        }
    }

    @PostMapping("/{id}/acknowledge")
    public ResponseEntity<?> acknowledge(@PathVariable String id) {
        AlertNotification notif;
        synchronized (state.lock) {
            notif = state.notifications.stream().filter(n -> id.equals(n.getId())).findFirst().orElse(null);
            if (notif != null) {
                notif.setStatus("ACKNOWLEDGED");
            }
        }
        if (notif != null) {
            logService.addLog("SYSTEM_INFO", "INFO", "標記警報為已確認: " + notif.getCveId(), notif.getProductName());
            stateService.persist();
        }
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("notif", notif);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable String id) {
        AlertNotification notif;
        synchronized (state.lock) {
            notif = state.notifications.stream().filter(n -> id.equals(n.getId())).findFirst().orElse(null);
            if (notif != null) {
                notif.setStatus("RESOLVED");
                MonitoredProduct prod = state.products.stream().filter(p -> notif.getProductName().equals(p.getName())).findFirst().orElse(null);
                if (prod != null && prod.getActiveAlertCount() > 0) {
                    prod.setActiveAlertCount(prod.getActiveAlertCount() - 1);
                }
            }
        }
        if (notif != null) {
            logService.addLog("SYSTEM_INFO", "SUCCESS", "已修復並關閉警報: " + notif.getCveId(), notif.getProductName());
            stateService.persist();
        }
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("notif", notif);
        return ResponseEntity.ok(response);
    }
}
