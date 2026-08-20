package com.sentinelcve.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.catalog.ProductCatalog;
import com.sentinelcve.model.CveItem;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.provider.ProductProviderService;
import com.sentinelcve.service.AlertRuleEngineService;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.ScanService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
 * Java port of server.ts lines 1417-1539.
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ScanService scanService;
    private final AlertRuleEngineService alertRuleEngineService;
    private final ProductProviderService productProviderService;
    private final ObjectMapper objectMapper;

    public ProductController(AppState state, StateService stateService, LogService logService, ScanService scanService,
                             AlertRuleEngineService alertRuleEngineService, ProductProviderService productProviderService,
                             ObjectMapper objectMapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.scanService = scanService;
        this.alertRuleEngineService = alertRuleEngineService;
        this.productProviderService = productProviderService;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<?> getProducts() {
        synchronized (state.lock) {
            return ResponseEntity.ok(new ArrayList<>(state.products));
        }
    }

    @PostMapping
    public ResponseEntity<?> createProduct(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        String name = asString(request.get("name"));
        String cpeKeyword = asString(request.get("cpeKeyword"));
        if (!hasText(name) || !hasText(cpeKeyword)) {
            return ResponseEntity.badRequest().body(error("Name and CPE keyword are required."));
        }

        MonitoredProduct newProd = new MonitoredProduct();
        newProd.setId("prod-" + System.currentTimeMillis());
        newProd.setName(name);
        newProd.setVendor(firstNonBlank(asString(request.get("vendor")), "Generic"));
        newProd.setCategory(firstNonBlank(asString(request.get("category")), "Application"));
        newProd.setCpeKeyword(cpeKeyword);
        newProd.setCriticality(firstNonBlank(asString(request.get("criticality")), "HIGH"));
        newProd.setAutoScanEnabled(true);
        newProd.setScanIntervalMinutes(numberOrDefault(request.get("scanIntervalMinutes"), 30));
        newProd.setLastScannedAt(Instant.now().toString());
        newProd.setDetectedCveCount(0);
        newProd.setActiveAlertCount(0);
        newProd.setCurrentVersion(asString(request.get("currentVersion")));
        newProd.setSourceType(firstNonBlank(asString(request.get("sourceType")), "auto"));
        newProd.setEcosystem(asString(request.get("ecosystem")));
        newProd.setPackageName(asString(request.get("packageName")));
        newProd.setPurl(asString(request.get("purl")));
        newProd.setCpe(asString(request.get("cpe")));
        newProd.setRepository(asString(request.get("repository")));
        newProd.setVendorReleaseUrl(asString(request.get("vendorReleaseUrl")));
        newProd.setReleaseChannel(firstNonBlank(asString(request.get("releaseChannel")), "stable"));
        ProductCatalog.enrichProductFromCatalog(newProd);

        synchronized (state.lock) {
            state.products.add(newProd);
        }
        logService.addLog("SYSTEM_INFO", "INFO",
            "新增監控產品: " + newProd.getName(),
            newProd.getName(),
            "類別: " + newProd.getCategory() + ", CPE: " + newProd.getCpeKeyword());

        try {
            List<CveItem> foundCves = scanService.scanProductFromVerifiedSources(newProd);
            for (CveItem cve : foundCves) {
                alertRuleEngineService.evaluateAlertRules(cve, newProd);
            }
        } catch (Exception err) {
            logService.addLog("AUTO_SCAN", "WARNING",
                "產品新增成功，但首次精確漏洞掃描未執行: " + safeMessage(err, "識別資料不足"),
                newProd.getName());
        }

        stateService.persist();
        return ResponseEntity.ok(newProd);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProduct(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) throws Exception {
        Map<String, Object> request = body != null ? body : Map.of();
        MonitoredProduct prod;
        synchronized (state.lock) {
            prod = state.products.stream().filter(p -> id.equals(p.getId())).findFirst().orElse(null);
        }
        if (prod == null) {
            return ResponseEntity.status(404).body(error("Product not found"));
        }

        synchronized (state.lock) {
            MonitoredProduct merged = objectMapper.convertValue(prod, MonitoredProduct.class);
            objectMapper.updateValue(merged, request);
            ProductCatalog.enrichProductFromCatalog(merged);
            objectMapper.updateValue(prod, objectMapper.convertValue(merged, Map.class));
        }

        logService.addLog("SYSTEM_INFO", "INFO", "更新產品設定: " + prod.getName(), prod.getName());
        stateService.persist();
        return ResponseEntity.ok(prod);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable String id) {
        MonitoredProduct removed = null;
        synchronized (state.lock) {
            int idx = -1;
            for (int i = 0; i < state.products.size(); i++) {
                if (id.equals(state.products.get(i).getId())) {
                    idx = i;
                    break;
                }
            }
            if (idx != -1) {
                removed = state.products.remove(idx);
            }
        }
        if (removed != null) {
            logService.addLog("SYSTEM_INFO", "INFO", "刪除監控產品: " + removed.getName(), removed.getName());
            stateService.persist();
        }
        return ResponseEntity.ok(successOnly());
    }

    @PostMapping("/{id}/check-version")
    public ResponseEntity<?> checkVersion(@PathVariable String id) {
        MonitoredProduct prod;
        synchronized (state.lock) {
            prod = state.products.stream().filter(p -> id.equals(p.getId())).findFirst().orElse(null);
        }
        if (prod == null) {
            return ResponseEntity.status(404).body(error("Product not found"));
        }

        try {
            ProductProviderService.VersionResult result = productProviderService.getLatestVersion(prod);
            synchronized (state.lock) {
                applyVersionResult(prod, result);
            }
            logService.addLog(
                "SYSTEM_INFO",
                "SUCCESS",
                "[新版本監控] 產品【" + prod.getName() + "】版本檢查完成 - 目前: v" + firstNonBlank(prod.getCurrentVersion(), "未知")
                    + ", 最新安全版: v" + prod.getLatestSecureVersion(),
                prod.getName(),
                "來源: " + result.getSourceUrl() + " / 可信度: " + result.getConfidence()
            );
            stateService.persist();
            return ResponseEntity.ok(prod);
        } catch (Exception err) {
            logService.addLog("SYSTEM_INFO", "ERROR",
                "產品【" + prod.getName() + "】官方版本檢查失敗: " + safeMessage(err, "未知錯誤"),
                prod.getName());
            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("error", safeMessage(err, "官方版本檢查失敗"));
            return ResponseEntity.status(502).body(response);
        }
    }

    @PostMapping("/check-all-versions")
    public ResponseEntity<?> checkAllVersions() {
        int updatedCount = 0;
        List<Map<String, String>> errors = new ArrayList<>();
        List<MonitoredProduct> productsSnapshot;
        synchronized (state.lock) {
            productsSnapshot = List.copyOf(state.products);
        }
        for (MonitoredProduct prod : productsSnapshot) {
            try {
                ProductProviderService.VersionResult result = productProviderService.getLatestVersion(prod);
                synchronized (state.lock) {
                    applyVersionResult(prod, result);
                }
                updatedCount++;
            } catch (Exception err) {
                LinkedHashMap<String, String> error = new LinkedHashMap<>();
                error.put("productId", prod.getId());
                error.put("productName", prod.getName());
                error.put("error", safeMessage(err, "版本檢查失敗"));
                errors.add(error);
            }
        }
        logService.addLog("AI_ANALYSIS", errors.isEmpty() ? "SUCCESS" : "WARNING",
            "全站版本清查完成：成功 " + updatedCount + "、失敗 " + errors.size(),
            "Version Audit Engine");
        if (updatedCount > 0) stateService.persist();

        List<MonitoredProduct> responseProducts;
        synchronized (state.lock) {
            responseProducts = new ArrayList<>(state.products);
        }
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", errors.isEmpty());
        response.put("count", updatedCount);
        response.put("products", responseProducts);
        response.put("errors", errors);
        return ResponseEntity.status(errors.size() == responseProducts.size() && !responseProducts.isEmpty() ? 502 : 200).body(response);
    }

    private void applyVersionResult(MonitoredProduct prod, ProductProviderService.VersionResult result) {
        prod.setLatestVersion(result.getLatestVersion());
        prod.setLatestSecureVersion(result.getLatestSecureVersion());
        prod.setHasUpdateAvailable(prod.getCurrentVersion() != null && !prod.getCurrentVersion().isBlank()
            && !java.util.Objects.equals(result.getLatestSecureVersion(), prod.getCurrentVersion()));
        prod.setLatestReleaseDate(result.getReleaseDate());
        prod.setUpdateNotes(result.getNotes());
        prod.setSourceType(productProviderService.resolveSourceType(prod));
        prod.setVersionSourceUrl(result.getSourceUrl());
        prod.setVersionCheckedAt(result.getCheckedAt());
        prod.setVersionConfidence(result.getConfidence());
        prod.setLastScannedAt(result.getCheckedAt());
    }

    private LinkedHashMap<String, Object> error(String message) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return body;
    }

    private LinkedHashMap<String, Object> successOnly() {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        return body;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static int numberOrDefault(Object value, int defaultValue) {
        if (value == null || String.valueOf(value).isBlank()) return defaultValue;
        double parsed = value instanceof Number number ? number.doubleValue() : Double.parseDouble(String.valueOf(value));
        return parsed == 0 ? defaultValue : (int) parsed;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
