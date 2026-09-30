package com.sentinelcve.controller;

import com.sentinelcve.db.PersistenceRepository;
import com.sentinelcve.model.MonitoredProduct;
import com.sentinelcve.model.Project;
import com.sentinelcve.model.ProjectProductBinding;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Read-only global monitored-product catalog used by the dashboard and the "使用產品清單"
 * dropdown when binding a product to a project. Backed by {@code product_cpe_cache} (maintained
 * under 系統管理 &gt; 產品管理, including periodic NVD CPE auto-refresh) rather than the legacy
 * {@code products} table, which has no creation UI/API and is therefore always empty. Each
 * project then applies its own target version/environment via {@link ProjectProductBinding},
 * and CVE scanning runs per project-binding (see ScanService#scanProjectBinding) rather than
 * globally per product.
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final AppState state;
    private final PersistenceRepository persistenceRepository;

    public ProductController(AppState state, PersistenceRepository persistenceRepository) {
        this.state = state;
        this.persistenceRepository = persistenceRepository;
    }

    @GetMapping
    public ResponseEntity<?> getProducts() {
        List<Map<String, Object>> entries = persistenceRepository.listCpeCacheEntries();
        List<ProjectProductBinding> allBindings;
        synchronized (state.lock) {
            allBindings = new ArrayList<>();
            for (Project project : state.projects) {
                if (project.getProductBindings() != null) allBindings.addAll(project.getProductBindings());
            }
        }

        List<MonitoredProduct> products = new ArrayList<>();
        for (Map<String, Object> entry : entries) {
            products.add(toMonitoredProduct(entry, allBindings));
        }
        return ResponseEntity.ok(products);
    }

    /** Builds a MonitoredProduct-shaped projection from a product_cpe_cache entry so the
     * frontend (which already expects this shape) doesn't need any structural changes. */
    private MonitoredProduct toMonitoredProduct(Map<String, Object> entry, List<ProjectProductBinding> allBindings) {
        String name = (String) entry.get("productName");
        String key = (String) entry.get("productNameKey");

        String vendor = "";
        String cpe = null;
        Object candidatesObj = entry.get("candidates");
        if (candidatesObj instanceof com.fasterxml.jackson.databind.JsonNode candidatesNode && candidatesNode.isArray()) {
            com.fasterxml.jackson.databind.JsonNode chosen = null;
            for (com.fasterxml.jackson.databind.JsonNode candidate : candidatesNode) {
                if (!candidate.path("deprecated").asBoolean(false)) { chosen = candidate; break; }
            }
            if (chosen == null && candidatesNode.size() > 0) chosen = candidatesNode.get(0);
            if (chosen != null) {
                vendor = chosen.path("vendor").asText("");
                cpe = chosen.path("cpe").asText(null);
            }
        }

        MonitoredProduct product = new MonitoredProduct();
        product.setId(key);
        product.setName(name);
        product.setVendor(vendor);
        product.setCategory("");
        product.setCpe(cpe);
        product.setCpeKeyword(vendor != null && !vendor.isBlank() ? vendor + ":" + name.toLowerCase(java.util.Locale.ROOT) : name);
        product.setAutoScanEnabled(false);
        product.setScanIntervalMinutes(0);

        List<ProjectProductBinding> matching = allBindings.stream().filter(b -> key.equals(b.getProductId())).toList();
        product.setDetectedCveCount(matching.stream().mapToInt(ProjectProductBinding::getDetectedCveCount).sum());
        product.setActiveAlertCount(matching.stream().mapToInt(ProjectProductBinding::getActiveAlertCount).sum());
        matching.stream().map(ProjectProductBinding::getLastScannedAt).filter(java.util.Objects::nonNull)
            .max(java.util.Comparator.naturalOrder()).ifPresent(product::setLastScannedAt);

        return product;
    }
}
