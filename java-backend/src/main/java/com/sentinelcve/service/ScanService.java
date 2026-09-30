package com.sentinelcve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.db.PersistenceRepository;
import com.sentinelcve.model.*;
import com.sentinelcve.provider.ProductProviderService;
import com.sentinelcve.state.AppState;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;

/** Java port of searchCVEsFromSource() and scanProductFromVerifiedSources() in server.ts. */
@Service
public class ScanService {

    private final AppState state;
    private final ProductProviderService productProviderService;
    private final PersistenceRepository persistenceRepository;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();

    /** Delay between successive NVD cpeName queries when a single product name maps to multiple
     * vendor CPE candidates, to stay well under NVD's rate limit (5 req/30s without an API key,
     * 50 req/30s with one). */
    private static final long MULTI_CPE_QUERY_DELAY_MS = 1500;

    public ScanService(AppState state, ProductProviderService productProviderService,
                        PersistenceRepository persistenceRepository, ObjectMapper mapper) {
        this.state = state;
        this.productProviderService = productProviderService;
        this.persistenceRepository = persistenceRepository;
        this.mapper = mapper;
    }

    /** Scans a single verified product via ProductProviderService.getProductVulnerabilities,
     * merging discovered CVEs into cvesDatabase (update-if-present, else prepend). */
    public List<CveItem> scanProductFromVerifiedSources(MonitoredProduct product) throws Exception {
        List<CveItem> found = productProviderService.getProductVulnerabilities(product);
        synchronized (state.lock) {
            for (CveItem item : found) {
                int idx = -1;
                for (int i = 0; i < state.cvesDatabase.size(); i++) {
                    CveItem existing = state.cvesDatabase.get(i);
                    if (existing.getId().equals(item.getId()) && existing.getProductName().equals(product.getName())) {
                        idx = i;
                        break;
                    }
                }
                if (idx >= 0) {
                    state.cvesDatabase.set(idx, item);
                } else {
                    state.cvesDatabase.add(0, item);
                }
            }
        }
        product.setDetectedCveCount(found.size());
        product.setLastScannedAt(Instant.now().toString());
        return found;
    }

    /** Scans a single project's product binding for CVEs by resolving the exact CPE(s) (global
     * catalog's base CPE(s) + this project's targetVersion) and querying NVD's cpeName-match API,
     * mirroring ProductProviderService's CPE branch but scoped per project-binding rather than
     * per globally-managed MonitoredProduct. Since a single product name can map to multiple
     * different vendor CPE identities (e.g. the project's actual deployed version may come from
     * a different vendor than the one picked as the "representative" CPE at bind time), this
     * queries every non-deprecated candidate CPE cached for the binding's product name and
     * merges/dedupes the results by CVE ID, so no vendor's CVEs get silently missed. Falls back
     * to the single CPE snapshot stored on the binding (binding.getProductCpe()) if no cache
     * entry exists for this product name. Merges discovered CVEs into cvesDatabase and updates
     * the binding's own detectedCveCount/lastScannedAt. */
    public List<CveItem> scanProjectBinding(ProjectProductBinding binding) throws Exception {
        if (binding.getTargetVersion() == null || binding.getTargetVersion().isBlank()) {
            throw new RuntimeException("此套用產品缺少目標套用版本號，請先編輯設定版本。");
        }

        List<String> baseCpes = resolveNonDeprecatedBaseCpes(binding.getProductName(), binding.getProductCpe());
        if (baseCpes.isEmpty()) {
            throw new RuntimeException("此套用產品缺少全域產品目錄的 CPE 資訊，請重新選取產品後再試一次。");
        }

        LinkedHashMap<String, CveItem> found = new LinkedHashMap<>();
        for (int i = 0; i < baseCpes.size(); i++) {
            String[] parts = baseCpes.get(i).split(":");
            if (parts.length >= 6) parts[5] = binding.getTargetVersion();
            String exactCpe = String.join(":", parts);

            String sourceUrl = "https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=" +
                java.net.URLEncoder.encode(exactCpe, java.nio.charset.StandardCharsets.UTF_8) + "&isVulnerable";
            String nvdApiKey = resolveNvdApiKey();
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(sourceUrl))
                .timeout(Duration.ofSeconds(20)).header("User-Agent", "SentinelCVE/1.0").GET();
            if (nvdApiKey != null && !nvdApiKey.isBlank()) requestBuilder.header("apiKey", nvdApiKey);
            HttpResponse<String> response = http.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) throw new RuntimeException("NVD API 回傳 HTTP " + response.statusCode());

            JsonNode data = mapper.readTree(response.body());
            for (JsonNode entry : data.path("vulnerabilities")) {
                CveItem item = bindingToCve(entry.path("cve"), binding, exactCpe, sourceUrl);
                found.put(item.getId(), item);
            }

            if (i < baseCpes.size() - 1) Thread.sleep(MULTI_CPE_QUERY_DELAY_MS);
        }

        synchronized (state.lock) {
            for (CveItem item : found.values()) {
                int idx = -1;
                for (int i = 0; i < state.cvesDatabase.size(); i++) {
                    CveItem existing = state.cvesDatabase.get(i);
                    if (existing.getId().equals(item.getId()) && existing.getProductName().equals(binding.getProductName())) {
                        idx = i;
                        break;
                    }
                }
                if (idx >= 0) state.cvesDatabase.set(idx, item);
                else state.cvesDatabase.add(0, item);
            }
        }

        binding.setDetectedCveCount(found.size());
        binding.setLastScannedAt(Instant.now().toString());
        return new ArrayList<>(found.values());
    }

    /** Resolves the list of base CPEs (version wildcarded) to scan for a product name: every
     * non-deprecated candidate cached in product_cpe_cache for that name, or — if no cache entry
     * exists yet — a single-element list built from the fallback CPE snapshot stored on the
     * binding/MonitoredProduct at bind/list time (fallbackCpe may be null, in which case an empty
     * list is returned). */
    private List<String> resolveNonDeprecatedBaseCpes(String productName, String fallbackCpe) {
        List<ProductProviderService.CpeLookupResult> cached = productName == null ? null
            : persistenceRepository.getCachedCpeCandidates(productName, ProductProviderService.CpeLookupResult.class);
        if (cached != null && !cached.isEmpty()) {
            List<String> baseCpes = new ArrayList<>();
            for (ProductProviderService.CpeLookupResult candidate : cached) {
                if (!candidate.isDeprecated() && candidate.getCpe() != null) baseCpes.add(candidate.getCpe());
            }
            if (!baseCpes.isEmpty()) return baseCpes;
        }
        return (fallbackCpe != null && !fallbackCpe.isBlank()) ? List.of(fallbackCpe) : List.of();
    }

    private CveItem bindingToCve(JsonNode cve, ProjectProductBinding binding, String exactCpe, String sourceUrl) {
        JsonNode metric = firstNonMissingMetric(
            cve.path("metrics").path("cvssMetricV31"),
            cve.path("metrics").path("cvssMetricV30"),
            cve.path("metrics").path("cvssMetricV2"));
        JsonNode cvssData = metric != null ? metric.path("cvssData") : mapper.createObjectNode();

        String description = "No description";
        for (JsonNode d : cve.path("descriptions")) {
            if ("en".equals(d.path("lang").asText())) {
                description = d.path("value").asText(description);
                break;
            }
        }

        CveItem item = new CveItem();
        item.setId(cve.path("id").asText());
        item.setTitle(cve.path("id").asText() + ": " + description.substring(0, Math.min(100, description.length())));
        item.setDescription(description);
        item.setPublishedDate(cve.path("published").asText(null));
        item.setLastModifiedDate(cve.path("lastModified").asText(null));
        item.setProductName(binding.getProductName());
        item.setVendorName(binding.getVendor());

        CvssMetrics cvss = new CvssMetrics();
        double baseScore = cvssData.path("baseScore").asDouble(0);
        cvss.setBaseScore(baseScore);
        String severity = cvssData.path("baseSeverity").asText(null);
        cvss.setSeverity(severity == null ? "HIGH" : severity.toUpperCase(Locale.ROOT));
        cvss.setVectorString(cvssData.path("vectorString").asText(""));
        item.setCvss(cvss);

        item.setCisaKev(cve.path("cisaExploitAdd").isTextual());
        item.setCisaKevDueDate(cve.path("cisaActionDue").asText(null));
        item.setAffectedVersions(List.of(binding.getTargetVersion()));
        item.setCpe(List.of(exactCpe));

        List<ReferenceLink> refs = new ArrayList<>();
        int count = 0;
        for (JsonNode ref : cve.path("references")) {
            if (count++ >= 10) break;
            refs.add(new ReferenceLink(ref.path("source").asText("Reference"), ref.path("url").asText(null)));
        }
        item.setReferences(refs);
        item.setDataSources(new ArrayList<>(List.of(new DataSourceInfo("NVD", sourceUrl, Instant.now().toString()))));
        item.setMatchConfidence("HIGH");
        item.setMatchedBy("NVD_CPE_APPLICABILITY");
        return item;
    }

    private static JsonNode firstNonMissingMetric(JsonNode... nodes) {
        for (JsonNode n : nodes) {
            if (n != null && n.isArray() && n.size() > 0) return n.get(0);
        }
        return null;
    }

    /** Resolves the NVD API key: saved config (via 系統管理 > NVD API Key) takes priority over
     * the NVD_API_KEY environment variable. Returns null when neither is configured. */
    private String resolveNvdApiKey() {
        String saved;
        synchronized (state.lock) {
            saved = state.nvdApiConfig.getApiKey();
        }
        if (saved != null && !saved.isBlank()) return saved;
        String envKey = System.getenv("NVD_API_KEY");
        return (envKey != null && !envKey.isBlank()) ? envKey : null;
    }

    /** Java port of NVD keyword search fallback used by /api/cves/search. Refreshes from NVD,
     * merges into cvesDatabase, and returns the union of local + fetched matches. */
    public List<CveItem> searchCVEsFromSource(String keyword) {
        String queryLower = keyword.toLowerCase(Locale.ROOT).trim();
        List<CveItem> matched;
        synchronized (state.lock) {
            matched = new ArrayList<>(state.cvesDatabase.stream()
                .filter(c -> c.getProductName().toLowerCase(Locale.ROOT).contains(queryLower)
                    || c.getVendorName().toLowerCase(Locale.ROOT).contains(queryLower)
                    || c.getTitle().toLowerCase(Locale.ROOT).contains(queryLower)
                    || c.getId().toLowerCase(Locale.ROOT).contains(queryLower)
                    || c.getDescription().toLowerCase(Locale.ROOT).contains(queryLower))
                .toList());
        }

        try {
            String nvdUrl = "https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch="
                + java.net.URLEncoder.encode(keyword, java.nio.charset.StandardCharsets.UTF_8) + "&resultsPerPage=10";
            if (queryLower.startsWith("cve-")) {
                nvdUrl = "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId="
                    + java.net.URLEncoder.encode(keyword.toUpperCase(Locale.ROOT), java.nio.charset.StandardCharsets.UTF_8);
            }
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(nvdUrl))
                .timeout(Duration.ofSeconds(20)).header("User-Agent", "SentinelCVE/1.0").GET();
            String nvdApiKey = resolveNvdApiKey();
            if (nvdApiKey != null && !nvdApiKey.isBlank()) requestBuilder.header("apiKey", nvdApiKey);
            HttpResponse<String> response = http.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) throw new RuntimeException("NVD API 回傳 HTTP " + response.statusCode());

            JsonNode data = mapper.readTree(response.body());
            List<CveItem> fetchedItems = new ArrayList<>();
            for (JsonNode v : data.path("vulnerabilities")) {
                fetchedItems.add(toCveItem(v.path("cve"), keyword));
            }

            synchronized (state.lock) {
                for (CveItem item : fetchedItems) {
                    boolean exists = state.cvesDatabase.stream().anyMatch(e -> e.getId().equals(item.getId()));
                    if (!exists) state.cvesDatabase.add(0, item);
                }
            }

            java.util.LinkedHashMap<String, CveItem> merged = new java.util.LinkedHashMap<>();
            for (CveItem item : fetchedItems) merged.put(item.getId(), item);
            for (CveItem item : matched) merged.putIfAbsent(item.getId(), item);
            matched = new ArrayList<>(merged.values());
        } catch (Exception err) {
            // NVD fetch failed; fall back to whatever local records matched above.
        }

        return matched;
    }

    private CveItem toCveItem(JsonNode cve, String keyword) {
        JsonNode cvssData = firstNonMissing(cve.path("metrics").path("cvssMetricV31"), cve.path("metrics").path("cvssMetricV30"));
        double baseScore = cvssData != null ? cvssData.path("cvssData").path("baseScore").asDouble(7.5) : 7.5;
        String severity = cvssData != null ? cvssData.path("cvssData").path("baseSeverity").asText("HIGH") : "HIGH";
        String vector = cvssData != null ? cvssData.path("cvssData").path("vectorString").asText("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
            : "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H";

        String desc = null;
        for (JsonNode d : cve.path("descriptions")) {
            if ("en".equals(d.path("lang").asText())) {
                desc = d.path("value").asText();
                break;
            }
        }
        if (desc == null) desc = cve.path("descriptions").path(0).path("value").asText("無詳細描述");

        CveItem item = new CveItem();
        item.setId(cve.path("id").asText());
        item.setTitle(cve.path("id").asText() + ": " + desc.substring(0, Math.min(80, desc.length())) + "...");
        item.setDescription(desc);
        item.setPublishedDate(cve.path("published").asText(Instant.now().toString()));
        item.setLastModifiedDate(cve.path("lastModified").asText(Instant.now().toString()));
        item.setProductName(keyword);
        item.setVendorName(cve.path("sourceIdentifier").asText("NVD"));

        CvssMetrics cvss = new CvssMetrics();
        cvss.setBaseScore(baseScore);
        cvss.setSeverity(severity);
        cvss.setVectorString(vector);
        cvss.setAttackVector(cvssData != null ? cvssData.path("cvssData").path("attackVector").asText("NETWORK") : "NETWORK");
        cvss.setAttackComplexity(cvssData != null ? cvssData.path("cvssData").path("attackComplexity").asText("LOW") : "LOW");
        cvss.setPrivilegesRequired(cvssData != null ? cvssData.path("cvssData").path("privilegesRequired").asText("NONE") : "NONE");
        cvss.setUserInteraction(cvssData != null ? cvssData.path("cvssData").path("userInteraction").asText("NONE") : "NONE");
        cvss.setScope(cvssData != null ? cvssData.path("cvssData").path("scope").asText("UNCHANGED") : "UNCHANGED");
        cvss.setConfidentialityImpact(cvssData != null ? cvssData.path("cvssData").path("confidentialityImpact").asText("HIGH") : "HIGH");
        cvss.setIntegrityImpact(cvssData != null ? cvssData.path("cvssData").path("integrityImpact").asText("HIGH") : "HIGH");
        cvss.setAvailabilityImpact(cvssData != null ? cvssData.path("cvssData").path("availabilityImpact").asText("HIGH") : "HIGH");
        item.setCvss(cvss);

        item.setEpssScore(Math.round((Math.random() * 0.5 + 0.3) * 100) / 100.0);
        item.setCisaKev(baseScore >= 9.0);
        item.setAffectedVersions(List.of("NIST Verified"));
        item.setCpe(List.of("cpe:2.3:a:*:" + keyword.toLowerCase(Locale.ROOT) + ":*:*:*:*:*:*:*:*"));

        List<ReferenceLink> refs = new ArrayList<>();
        int count = 0;
        for (JsonNode ref : cve.path("references")) {
            if (count++ >= 3) break;
            refs.add(new ReferenceLink(ref.path("source").asText("NVD Reference"), ref.path("url").asText(null)));
        }
        item.setReferences(refs);
        return item;
    }

    private static JsonNode firstNonMissing(JsonNode... nodes) {
        for (JsonNode n : nodes) {
            if (n != null && n.isArray() && n.size() > 0) return n.get(0);
        }
        return null;
    }
}
