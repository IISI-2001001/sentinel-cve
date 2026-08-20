package com.sentinelcve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Locale;

/** Java port of searchCVEsFromSource() and scanProductFromVerifiedSources() in server.ts. */
@Service
public class ScanService {

    private final AppState state;
    private final ProductProviderService productProviderService;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();

    public ScanService(AppState state, ProductProviderService productProviderService, ObjectMapper mapper) {
        this.state = state;
        this.productProviderService = productProviderService;
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
            HttpRequest request = HttpRequest.newBuilder(URI.create(nvdUrl))
                .timeout(Duration.ofSeconds(20)).header("User-Agent", "SentinelCVE/1.0").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
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
