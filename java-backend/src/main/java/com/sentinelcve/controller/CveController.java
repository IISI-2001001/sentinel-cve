package com.sentinelcve.controller;

import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.service.AlertRuleEngineService;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.ScanService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Java port of the CVE list/search/scan endpoints. */
@RestController
public class CveController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ScanService scanService;
    private final AlertRuleEngineService alertRuleEngineService;

    public CveController(AppState state, StateService stateService, LogService logService, ScanService scanService,
                         AlertRuleEngineService alertRuleEngineService) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.scanService = scanService;
        this.alertRuleEngineService = alertRuleEngineService;
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
                for (CveItem cve : found) {
                    totalAlertsTriggered += alertRuleEngineService.evaluateAlertRules(cve, prod);
                }
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
