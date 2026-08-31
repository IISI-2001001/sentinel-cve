package com.sentinelcve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.sentinelcve.db.PersistenceRepository;
import com.sentinelcve.provider.ProductProviderService;
import lombok.Data;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Shared logic for checking every cached "產品管理" (product_cpe_cache) entry against NVD for
 * newly-published CPE identities. Used by both the manual "檢查所有產品是否有新 CPE" button
 * (CpeCacheController) and the CPE auto-update schedule (SchedulerService) so the two trigger
 * paths stay in sync and there is a single place to change the diff/refresh behaviour.
 */
@Service
public class CpeCacheService {

    private final PersistenceRepository persistenceRepository;
    private final ProductProviderService productProviderService;
    private final LogService logService;

    public CpeCacheService(PersistenceRepository persistenceRepository, ProductProviderService productProviderService,
                            LogService logService) {
        this.persistenceRepository = persistenceRepository;
        this.productProviderService = productProviderService;
        this.logService = logService;
    }

    @Data
    public static class ProductCpeUpdate {
        private String productName;
        private List<String> newCpes;
    }

    @Data
    public static class RefreshAllResult {
        private int checkedCount;
        private List<ProductCpeUpdate> updatedProducts = new ArrayList<>();
        private List<Map<String, String>> errors = new ArrayList<>();

        public int getUpdatedCount() {
            return updatedProducts.size();
        }
    }

    /**
     * Re-queries NVD for every product name already present in the CPE cache and, when the
     * fresh result contains CPE identities not already stored, overwrites the cache entry and
     * reports the diff. {@code triggeredBy} is only used for the audit log entry (e.g.
     * "手動觸發" vs "排程自動觸發").
     */
    public RefreshAllResult refreshAllCachedCpe(String triggeredBy) {
        List<Map<String, Object>> entries = persistenceRepository.listCpeCacheEntries();
        RefreshAllResult result = new RefreshAllResult();

        for (Map<String, Object> entry : entries) {
            String productName = String.valueOf(entry.get("productName"));
            result.setCheckedCount(result.getCheckedCount() + 1);
            try {
                Set<String> existingCpes = new LinkedHashSet<>();
                Object candidatesNode = entry.get("candidates");
                if (candidatesNode instanceof JsonNode node) {
                    for (JsonNode candidate : node) {
                        String cpe = candidate.path("cpe").asText(null);
                        if (cpe != null) existingCpes.add(cpe);
                    }
                }

                List<ProductProviderService.CpeLookupResult> fresh = productProviderService.searchCpeCandidates(productName);
                List<String> newCpes = new ArrayList<>();
                for (var candidate : fresh) {
                    if (!existingCpes.contains(candidate.getCpe())) newCpes.add(candidate.getCpe());
                }

                if (!newCpes.isEmpty()) {
                    persistenceRepository.saveCpeCandidates(productName, fresh);
                    ProductCpeUpdate update = new ProductCpeUpdate();
                    update.setProductName(productName);
                    update.setNewCpes(newCpes);
                    result.getUpdatedProducts().add(update);
                }
            } catch (Exception err) {
                LinkedHashMap<String, String> error = new LinkedHashMap<>();
                error.put("productName", productName);
                error.put("error", err.getMessage() != null ? err.getMessage() : "NVD CPE 查詢失敗");
                result.getErrors().add(error);
            }
        }

        logService.addLog("SYSTEM_INFO", result.getErrors().isEmpty() ? "SUCCESS" : "WARNING",
            "[" + triggeredBy + "] CPE 對照自動更新完成：共檢查 " + result.getCheckedCount() + " 項產品，其中 "
                + result.getUpdatedCount() + " 項發現新 CPE、" + result.getErrors().size() + " 項查詢失敗",
            "CPE Auto Update");
        return result;
    }
}
