package com.sentinelcve.controller;

import com.sentinelcve.db.PersistenceRepository;
import com.sentinelcve.provider.ProductProviderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Admin management endpoints for the "CPE 對照管理" page under 系統管理與設定中心.
 * Exposes the {@code product_cpe_cache} table (product name -> NVD-derived vendor:product CPE
 * identities, version wildcarded) so an administrator can inspect, manually refresh from NVD,
 * manually add/edit entries, or delete stale ones — independent of the "新增產品" flow.
 */
@RestController
@RequestMapping("/api/cpe-cache")
public class CpeCacheController {

    private final PersistenceRepository persistenceRepository;
    private final ProductProviderService productProviderService;

    public CpeCacheController(PersistenceRepository persistenceRepository,
                               ProductProviderService productProviderService) {
        this.persistenceRepository = persistenceRepository;
        this.productProviderService = productProviderService;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(Map.of("entries", persistenceRepository.listCpeCacheEntries()));
    }

    /** Fetches fresh candidates from NVD for productName and (re)stores them in the cache. */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, Object> body) {
        String productName = asString(body.get("productName"));
        if (!hasText(productName)) {
            return ResponseEntity.badRequest().body(error("productName is required."));
        }
        try {
            List<ProductProviderService.CpeLookupResult> candidates = productProviderService.searchCpeCandidates(productName);
            persistenceRepository.saveCpeCandidates(productName, candidates);
            return ResponseEntity.ok(Map.of("productName", productName, "candidates", candidates));
        } catch (Exception err) {
            return ResponseEntity.status(502).body(error(err.getMessage() != null ? err.getMessage() : "NVD CPE 查詢失敗"));
        }
    }

    /** Manually creates/overwrites a cache entry with a hand-curated candidate list (no NVD call). */
    @PostMapping
    public ResponseEntity<?> saveManual(@RequestBody Map<String, Object> body) {
        String productName = asString(body.get("productName"));
        if (!hasText(productName)) {
            return ResponseEntity.badRequest().body(error("productName is required."));
        }
        Object rawCandidates = body.get("candidates");
        if (!(rawCandidates instanceof List<?> list)) {
            return ResponseEntity.badRequest().body(error("candidates must be an array."));
        }
        List<LinkedHashMap<String, Object>> normalized = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            String cpe = asString(map.get("cpe"));
            if (!hasText(cpe)) continue;
            String[] parts = cpe.split(":");
            String vendor = parts.length > 3 ? parts[3] : "";
            String product = parts.length > 4 ? parts[4] : "";
            LinkedHashMap<String, Object> entry = new LinkedHashMap<>();
            entry.put("cpe", cpe);
            entry.put("vendor", firstNonBlank(asString(map.get("vendor")), vendor));
            entry.put("product", firstNonBlank(asString(map.get("product")), product));
            entry.put("title", asString(map.get("title")));
            entry.put("deprecated", Boolean.TRUE.equals(map.get("deprecated")));
            normalized.add(entry);
        }
        if (normalized.isEmpty()) {
            return ResponseEntity.badRequest().body(error("至少需要一筆有效的 CPE 內容。"));
        }
        persistenceRepository.saveCpeCandidates(productName, normalized);
        return ResponseEntity.ok(Map.of("productName", productName, "candidates", normalized));
    }

    @DeleteMapping("/{productName}")
    public ResponseEntity<?> delete(@PathVariable String productName) {
        persistenceRepository.deleteCpeCacheEntry(productName);
        return ResponseEntity.ok(Map.of("success", true));
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private LinkedHashMap<String, Object> error(String message) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return body;
    }
}
