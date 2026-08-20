package com.sentinelcve.controller;

import com.sentinelcve.catalog.ProductCatalog;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.provider.ProductProviderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of server.ts lines 692-719.
 */
@RestController
@RequestMapping("/api/product-catalog")
public class ProductCatalogController {

    private final ProductProviderService productProviderService;

    public ProductCatalogController(ProductProviderService productProviderService) {
        this.productProviderService = productProviderService;
    }

    @GetMapping
    public ResponseEntity<?> getCatalog() {
        return ResponseEntity.ok(ProductCatalog.CATALOG);
    }

    @PostMapping("/check-all-versions")
    public ResponseEntity<?> checkAllVersions() {
        List<Map<String, Object>> results = new ArrayList<>();
        for (ProductCatalog.Entry entry : ProductCatalog.CATALOG) {
            MonitoredProduct product = new MonitoredProduct();
            product.setId("catalog-" + entry.getId());
            product.setName(entry.getName());
            product.setVendor(entry.getVendor());
            product.setCategory(entry.getCategory());
            product.setCurrentVersion("");
            product.setSourceType("auto");
            ProductCatalog.enrichProductFromCatalog(product);

            try {
                ProductProviderService.VersionResult version = productProviderService.getLatestVersion(product);
                LinkedHashMap<String, Object> row = new LinkedHashMap<>();
                row.put("id", entry.getId());
                row.put("name", entry.getName());
                row.put("success", true);
                row.put("latestVersion", version.getLatestVersion());
                row.put("latestSecureVersion", version.getLatestSecureVersion());
                row.put("releaseDate", version.getReleaseDate());
                row.put("notes", version.getNotes());
                row.put("sourceType", version.getSourceType());
                row.put("sourceUrl", version.getSourceUrl());
                row.put("confidence", version.getConfidence());
                row.put("checkedAt", version.getCheckedAt());
                results.add(row);
            } catch (Exception error) {
                LinkedHashMap<String, Object> row = new LinkedHashMap<>();
                row.put("id", entry.getId());
                row.put("name", entry.getName());
                row.put("success", false);
                row.put("error", safeMessage(error, "版本檢查失敗"));
                results.add(row);
            }
        }

        int passed = (int) results.stream().filter(result -> Boolean.TRUE.equals(result.get("success"))).count();
        int failed = results.size() - passed;
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", failed == 0);
        body.put("total", results.size());
        body.put("passed", passed);
        body.put("failed", failed);
        body.put("checkedAt", Instant.now().toString());
        body.put("results", results);
        return ResponseEntity.status(failed == results.size() ? 502 : 200).body(body);
    }

    private static String safeMessage(Exception error, String fallback) {
        return error.getMessage() != null ? error.getMessage() : fallback;
    }
}
