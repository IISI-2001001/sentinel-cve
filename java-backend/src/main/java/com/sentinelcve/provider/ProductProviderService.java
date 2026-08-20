package com.sentinelcve.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.MonitoredProduct;
import lombok.Data;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Java port of src/server/productProviders.ts: resolves the latest verified vendor/registry
 * version for a monitored product (getLatestVersion) via GitHub Releases/Tags, npm, PyPI,
 * endoflife.date, or a small set of hardcoded vendor-page scraping regexes. */
@Service
public class ProductProviderService {

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    private final ObjectMapper mapper = new ObjectMapper();

    @Data
    public static class VersionResult {
        private String latestVersion;
        private String latestSecureVersion;
        private String releaseDate;
        private String notes;
        private String sourceType;
        private String sourceUrl;
        private String confidence; // HIGH | MEDIUM | LOW
        private String checkedAt;
    }

    private record Identity(String ecosystem, String name) {
    }

    private HttpResponse<String> fetchTimed(String url) throws Exception {
        return fetchTimed(url, "GET", null, java.util.Map.of());
    }

    private HttpResponse<String> fetchTimed(String url, String method, String body, java.util.Map<String, String> headers) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(20))
            .header("User-Agent", "SentinelCVE/1.0");
        headers.forEach(builder::header);
        if ("POST".equals(method)) {
            builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body == null ? "" : body));
        } else {
            builder.GET();
        }
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            throw new RuntimeException(url + " 回傳 HTTP " + response.statusCode());
        }
        return response;
    }

    private static int[] versionParts(String v) {
        String cleaned = v.replaceFirst("^v", "");
        String[] parts = cleaned.split("[.-]");
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            try {
                out[i] = Integer.parseInt(parts[i].replaceAll("[^0-9]", ""));
            } catch (NumberFormatException e) {
                out[i] = 0;
            }
        }
        return out;
    }

    public static int compareVersions(String a, String b) {
        int[] ap = versionParts(a);
        int[] bp = versionParts(b);
        int max = Math.max(ap.length, bp.length);
        for (int i = 0; i < max; i++) {
            int av = i < ap.length ? ap[i] : 0;
            int bv = i < bp.length ? bp[i] : 0;
            if (av != bv) return av - bv;
        }
        return 0;
    }

    private Identity packageIdentity(MonitoredProduct product) {
        if (product.getPurl() != null) {
            Matcher m = Pattern.compile("^pkg:([^/]+)/([^@?]+)(?:@[^?]+)?", Pattern.CASE_INSENSITIVE).matcher(product.getPurl());
            if (m.find()) {
                return new Identity(m.group(1).toLowerCase(Locale.ROOT), java.net.URLDecoder.decode(m.group(2), java.nio.charset.StandardCharsets.UTF_8));
            }
        }
        String ecosystem = product.getEcosystem() != null ? product.getEcosystem().toLowerCase(Locale.ROOT) : null;
        String name = product.getPackageName() != null ? product.getPackageName() : product.getName();
        return new Identity(ecosystem, name);
    }

    public String resolveSourceType(MonitoredProduct product) {
        if (product.getSourceType() != null && !product.getSourceType().equals("auto")) return product.getSourceType();
        if (containsIgnoreCase(product.getName(), "postgresql") || containsIgnoreCase(product.getCpeKeyword(), "postgresql")) return "postgresql";
        if (product.getRepository() != null) return "github";
        Identity identity = packageIdentity(product);
        if ("npm".equals(identity.ecosystem())) return "npm";
        if ("pypi".equals(identity.ecosystem())) return "pypi";
        return "vendor";
    }

    private static boolean containsIgnoreCase(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static final java.util.Map<String, String> EOL_PRODUCT_SLUGS = java.util.Map.ofEntries(
        java.util.Map.entry("mysql", "mysql"),
        java.util.Map.entry("microsoft windows", "windows"),
        java.util.Map.entry("windows server", "windows-server"),
        java.util.Map.entry("apache hop", "apache-hop"),
        java.util.Map.entry("gitlab", "gitlab"),
        java.util.Map.entry("apache http server", "apache-http-server"),
        java.util.Map.entry("apache tomcat", "tomcat"),
        java.util.Map.entry("red hat enterprise linux", "rhel"),
        java.util.Map.entry("rocky linux", "rocky-linux"),
        java.util.Map.entry("ubuntu", "ubuntu")
    );

    private static boolean stableVersion(String value) {
        return !Pattern.compile("(?:alpha|beta|preview|pre|rc|snapshot|nightly)", Pattern.CASE_INSENSITIVE).matcher(value).find();
    }

    private VersionResult getEndOfLifeVersion(MonitoredProduct product, String slug, String checkedAt) throws Exception {
        String apiUrl = "https://endoflife.date/api/v1/products/" + slug;
        JsonNode payload = mapper.readTree(fetchTimed(apiUrl, "GET", null, java.util.Map.of("Accept", "application/json")).body());
        List<String[]> candidates = new ArrayList<>(); // [version, date]
        JsonNode releases = payload.path("result").path("releases");
        for (JsonNode release : releases) {
            String version = release.path("latest").path("name").asText(release.path("name").asText(""));
            String date = release.path("latest").path("date").asText(release.path("releaseDate").asText(null));
            if (!version.isEmpty() && stableVersion(version)) candidates.add(new String[]{version, date});
        }
        candidates.sort((a, b) -> compareVersions(b[0], a[0]));
        if (candidates.isEmpty()) throw new RuntimeException(product.getName() + " 的結構化生命週期來源未回傳穩定版本。");
        String[] latest = candidates.get(0);
        VersionResult result = new VersionResult();
        result.setLatestVersion(latest[0]);
        result.setLatestSecureVersion(latest[0]);
        result.setReleaseDate(latest[1]);
        result.setNotes("來源為 endoflife.date 的 " + product.getName() + " 結構化生命週期資料；該資料由上游官方發行來源維護。");
        result.setSourceType(resolveSourceType(product));
        result.setSourceUrl("https://endoflife.date/" + slug);
        result.setConfidence("MEDIUM");
        result.setCheckedAt(checkedAt);
        return result;
    }

    public VersionResult getLatestVersion(MonitoredProduct product) throws Exception {
        String sourceType = resolveSourceType(product);
        String checkedAt = Instant.now().toString();
        String eolSlug = EOL_PRODUCT_SLUGS.get(product.getName().toLowerCase(Locale.ROOT));
        if (eolSlug != null) return getEndOfLifeVersion(product, eolSlug, checkedAt);

        if ("postgresql".equals(sourceType)) {
            String sourceUrl = "https://www.postgresql.org/docs/release/";
            String html = fetchTimed(sourceUrl).body();
            Matcher m = Pattern.compile("href=[\"']/docs/release/(\\d+\\.\\d+)/[\"']", Pattern.CASE_INSENSITIVE).matcher(html);
            List<String> versions = new ArrayList<>();
            while (m.find()) versions.add(m.group(1));
            if (versions.isEmpty()) throw new RuntimeException("無法從 PostgreSQL 官方 Release Notes 解析版本。");
            versions.sort(ProductProviderService::compareVersions);
            String latestVersion = versions.get(versions.size() - 1);
            return build(latestVersion, latestVersion, null, "來源為 PostgreSQL 官方 Release Notes。", sourceType, sourceUrl, "HIGH", checkedAt);
        }

        if ("github".equals(sourceType)) {
            if (product.getRepository() == null) throw new RuntimeException("GitHub Provider 需要 repository，例如 owner/repo。");
            String releasesUrl = "https://api.github.com/repos/" + product.getRepository() + "/releases?per_page=100";
            JsonNode releases = mapper.readTree(fetchTimed(releasesUrl, "GET", null, java.util.Map.of("Accept", "application/vnd.github+json")).body());
            List<JsonNode> stableReleases = new ArrayList<>();
            for (JsonNode r : releases) {
                boolean draft = r.path("draft").asBoolean(false);
                boolean prerelease = r.path("prerelease").asBoolean(false);
                String tag = r.path("tag_name").asText(r.path("name").asText(""));
                if (!draft && !prerelease && stableVersion(tag)) stableReleases.add(r);
            }
            stableReleases.sort((a, b) -> compareVersions(
                b.path("tag_name").asText("").replaceFirst("(?i)^v", ""),
                a.path("tag_name").asText("").replaceFirst("(?i)^v", "")));
            for (JsonNode r : stableReleases) {
                String parsed = r.path("tag_name").asText("").replaceFirst("(?i)^v", "");
                if (Pattern.compile("\\d").matcher(parsed).find()) {
                    return build(parsed, parsed, r.path("published_at").asText(null),
                        r.path("name").asText("GitHub release " + r.path("tag_name").asText()),
                        sourceType, r.path("html_url").asText(releasesUrl), "HIGH", checkedAt);
                }
            }

            String tagsUrl = "https://api.github.com/repos/" + product.getRepository() + "/tags?per_page=100";
            JsonNode tags = mapper.readTree(fetchTimed(tagsUrl, "GET", null, java.util.Map.of("Accept", "application/vnd.github+json")).body());
            List<String> stableTags = new ArrayList<>();
            for (JsonNode t : tags) {
                String name = t.path("name").asText("");
                if (Pattern.compile("\\d").matcher(name).find() && stableVersion(name)) stableTags.add(name);
            }
            stableTags.sort(ProductProviderService::compareVersions);
            java.util.Collections.reverse(stableTags);
            if (stableTags.isEmpty()) throw new RuntimeException("GitHub 專案沒有可用的穩定 release 或 tag。");
            String latestVersion = stableTags.get(0).replaceFirst("(?i)^v", "");
            return build(latestVersion, latestVersion, null, "GitHub stable tag " + stableTags.get(0), sourceType,
                "https://github.com/" + product.getRepository() + "/releases/tag/" + stableTags.get(0), "HIGH", checkedAt);
        }

        Identity identity = packageIdentity(product);
        if ("npm".equals(sourceType)) {
            String sourceUrl = "https://registry.npmjs.org/" + java.net.URLEncoder.encode(identity.name(), java.nio.charset.StandardCharsets.UTF_8) + "/latest";
            JsonNode data = mapper.readTree(fetchTimed(sourceUrl).body());
            if (!data.has("version")) throw new RuntimeException("npm Registry 未回傳版本。");
            String v = data.get("version").asText();
            return build(v, v, null, data.path("description").asText("npm latest dist-tag"), sourceType, sourceUrl, "HIGH", checkedAt);
        }

        if ("pypi".equals(sourceType)) {
            String sourceUrl = "https://pypi.org/pypi/" + java.net.URLEncoder.encode(identity.name(), java.nio.charset.StandardCharsets.UTF_8) + "/json";
            JsonNode data = mapper.readTree(fetchTimed(sourceUrl).body());
            String latestVersion = data.path("info").path("version").asText(null);
            if (latestVersion == null) throw new RuntimeException("PyPI 未回傳版本。");
            JsonNode files = data.path("releases").path(latestVersion);
            String releaseDate = files.isArray() && files.size() > 0 ? files.get(0).path("upload_time_iso_8601").asText(null) : null;
            return build(latestVersion, latestVersion, releaseDate, data.path("info").path("summary").asText("PyPI latest release"),
                sourceType, data.path("info").path("project_url").asText(sourceUrl), "HIGH", checkedAt);
        }

        if ("vendor".equals(sourceType) && product.getVendorReleaseUrl() != null) {
            return getVendorVersion(product, sourceType, checkedAt);
        }

        throw new RuntimeException("無可驗證的版本 Provider。請設定來源類型及 packageName/PURL、repository，或新增該廠商的官方 Adapter。");
    }

    private VersionResult getVendorVersion(MonitoredProduct product, String sourceType, String checkedAt) throws Exception {
        String nameLower = product.getName().toLowerCase(Locale.ROOT);

        if (nameLower.equals("python")) {
            String sourceUrl = "https://www.python.org/api/v2/downloads/release/?is_published=true";
            JsonNode releases = mapper.readTree(fetchTimed(sourceUrl, "GET", null, java.util.Map.of("Accept", "application/json")).body());
            List<JsonNode> stable = new ArrayList<>();
            for (JsonNode r : releases) {
                boolean pre = r.path("pre_release").asBoolean(false);
                String name = r.path("name").asText("");
                if (!pre && Pattern.compile("^Python\\s+3\\.\\d+\\.\\d+$", Pattern.CASE_INSENSITIVE).matcher(name).matches()) stable.add(r);
            }
            stable.sort((a, b) -> compareVersions(
                b.path("name").asText("").replaceFirst("(?i)^Python\\s+", ""),
                a.path("name").asText("").replaceFirst("(?i)^Python\\s+", "")));
            if (stable.isEmpty()) throw new RuntimeException("Python 官方 API 未回傳穩定的 Python 3 版本。");
            JsonNode latest = stable.get(0);
            String parsedVersion = latest.path("name").asText("").replaceFirst("(?i)^Python\\s+", "");
            return build(parsedVersion, parsedVersion, latest.path("release_date").asText(null),
                "來源為 Python.org 官方 Releases API，已排除 alpha、beta 與 release candidate。",
                sourceType, latest.path("release_page").asText(latest.path("release_notes_url").asText(sourceUrl)), "HIGH", checkedAt);
        }

        if (nameLower.contains("trinity data integration")) {
            return build("4.1", "4.1", "2022-03-02T00:00:00.000Z",
                "NetPro 官方 EOL/EOS 公告確認 4.0 已停止支援，並指定 4.1 為應移轉的受支援版本線；官網未公開最新修補版 feed，故不推測 4.1.x。",
                sourceType, product.getVendorReleaseUrl(), "MEDIUM", checkedAt);
        }

        String sourceUrl = product.getVendorReleaseUrl();
        String text = fetchTimed(sourceUrl).body();
        String latestVersion = "";

        if (nameLower.contains("sql server")) {
            latestVersion = firstSorted(findAll(text, "SQL Server\\s+(20\\d{2})"), true);
        } else if (nameLower.contains("oracle database")) {
            Matcher m = Pattern.compile("Oracle (?:AI )?Database\\s+(\\d+ai|\\d+c)", Pattern.CASE_INSENSITIVE).matcher(text);
            if (m.find()) latestVersion = m.group(1);
        } else if (nameLower.equals("vertica")) {
            latestVersion = firstSortedByVersion(findAll(text, "(?:Vertica|OpenText Analytics Database)\\s+(\\d+\\.\\d+(?:\\.\\d+)?)"));
        } else if (nameLower.contains("vmware esxi") || nameLower.contains("vmware vsphere")) {
            latestVersion = firstSortedByVersion(findAll(text, "ESX(?:i)?\\s+(\\d+\\.\\d+(?:\\.\\d+){0,3})").stream().filter(ProductProviderService::stableVersion).toList());
        } else if (nameLower.contains("vmware vcenter")) {
            latestVersion = firstSortedByVersion(findAll(text, "vCenter(?: Server)?\\s+(\\d+\\.\\d+(?:\\.\\d+){0,3})").stream().filter(ProductProviderService::stableVersion).toList());
        } else if (nameLower.contains("denodo platform")) {
            latestVersion = firstSortedByVersion(findAll(text, "Denodo Platform\\s+(\\d+(?:\\.\\d+)?)"));
        } else if (nameLower.contains("pentaho data integration")) {
            latestVersion = firstSortedByVersion(findAll(text, "Pentaho Data Integration(?: and Analytics)?\\s+(\\d+(?:\\.\\d+)?)"));
        } else if (nameLower.contains("tableau server")) {
            latestVersion = firstSortedByVersion(findAll(text, "(?:Tableau (?:Cloud/)?Server version|<td[^>]*>)\\s*(20\\d{2}\\.\\d+)"));
        } else if (nameLower.contains("power bi desktop")) {
            latestVersion = firstSortedByVersion(findAll(text, "(?:version|版本|verzia|versi|버전|версия)\\s*(2\\.\\d{3}\\.\\d+(?:\\.\\d+)?)"));
        } else if (nameLower.contains("7-zip")) {
            Matcher m = Pattern.compile("Download 7-Zip\\s+([\\d.]+)", Pattern.CASE_INSENSITIVE).matcher(text);
            if (m.find()) latestVersion = m.group(1);
        } else if (nameLower.contains("virtualbox")) {
            Matcher m = Pattern.compile("VirtualBox\\s+([7-9]\\.\\d+\\.\\d+)", Pattern.CASE_INSENSITIVE).matcher(text);
            if (m.find()) latestVersion = m.group(1);
        } else if (nameLower.contains("mysql")) {
            latestVersion = firstSortedByVersion(findAll(text, "MySQL Community Server\\s+([\\d.]+)"));
        }

        if (latestVersion.isEmpty()) {
            throw new RuntimeException("已設定官方版本頁，但尚無 " + product.getName() + " 的可靠解析規則；請建立專屬 Adapter。");
        }
        return build(latestVersion, latestVersion, null, "來源為 " + product.getVendor() + " 官方版本頁。", sourceType, sourceUrl, "HIGH", checkedAt);
    }

    private static List<String> findAll(String text, String regex) {
        List<String> out = new ArrayList<>();
        Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text);
        while (m.find()) out.add(m.group(1));
        return out;
    }

    private static String firstSorted(List<String> values, boolean lexical) {
        if (values.isEmpty()) return "";
        List<String> sorted = new ArrayList<>(values);
        java.util.Collections.sort(sorted);
        return sorted.get(sorted.size() - 1);
    }

    private static String firstSortedByVersion(List<String> values) {
        if (values.isEmpty()) return "";
        List<String> sorted = new ArrayList<>(values);
        sorted.sort(ProductProviderService::compareVersions);
        return sorted.get(sorted.size() - 1);
    }

    private static VersionResult build(String latestVersion, String latestSecureVersion, String releaseDate, String notes,
                                        String sourceType, String sourceUrl, String confidence, String checkedAt) {
        VersionResult r = new VersionResult();
        r.setLatestVersion(latestVersion);
        r.setLatestSecureVersion(latestSecureVersion);
        r.setReleaseDate(releaseDate);
        r.setNotes(notes);
        r.setSourceType(sourceType);
        r.setSourceUrl(sourceUrl);
        r.setConfidence(confidence);
        r.setCheckedAt(checkedAt);
        return r;
    }

    // --- Vulnerability lookup (getProductVulnerabilities in productProviders.ts) ---

    private static String normalizeSeverity(String value) {
        String upper = value == null ? "HIGH" : value.toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "CRITICAL", "HIGH", "MEDIUM", "LOW" -> upper;
            default -> "HIGH";
        };
    }

    private com.sentinelcve.model.CveItem nvdToCve(JsonNode entry, MonitoredProduct product, String sourceUrl) {
        JsonNode cve = entry.path("cve");
        JsonNode metric = firstNonMissing(
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

        com.sentinelcve.model.CveItem item = new com.sentinelcve.model.CveItem();
        item.setId(cve.path("id").asText());
        item.setTitle(cve.path("id").asText() + ": " + description.substring(0, Math.min(100, description.length())));
        item.setDescription(description);
        item.setPublishedDate(cve.path("published").asText(null));
        item.setLastModifiedDate(cve.path("lastModified").asText(null));
        item.setProductName(product.getName());
        item.setVendorName(product.getVendor());

        com.sentinelcve.model.CvssMetrics cvss = new com.sentinelcve.model.CvssMetrics();
        cvss.setBaseScore(cvssData.path("baseScore").asDouble(0));
        cvss.setSeverity(normalizeSeverity(cvssData.path("baseSeverity").asText(null)));
        cvss.setVectorString(cvssData.path("vectorString").asText(""));
        item.setCvss(cvss);

        item.setCisaKev(cve.path("cisaExploitAdd").isTextual());
        item.setCisaKevDueDate(cve.path("cisaActionDue").asText(null));
        item.setAffectedVersions(List.of(product.getCurrentVersion() != null ? product.getCurrentVersion() : "unknown"));
        item.setCpe(product.getCpe() != null ? List.of(product.getCpe()) : List.of());

        List<com.sentinelcve.model.ReferenceLink> refs = new ArrayList<>();
        JsonNode references = cve.path("references");
        int count = 0;
        for (JsonNode ref : references) {
            if (count++ >= 10) break;
            refs.add(new com.sentinelcve.model.ReferenceLink(ref.path("source").asText("Reference"), ref.path("url").asText(null)));
        }
        item.setReferences(refs);

        item.setDataSources(new ArrayList<>(List.of(new com.sentinelcve.model.DataSourceInfo("NVD", sourceUrl, Instant.now().toString()))));
        item.setMatchConfidence("HIGH");
        item.setMatchedBy("NVD_CPE_APPLICABILITY");
        return item;
    }

    private static JsonNode firstNonMissing(JsonNode... nodes) {
        for (JsonNode n : nodes) {
            if (n != null && n.isArray() && n.size() > 0) return n.get(0);
        }
        return null;
    }

    private String resolvedCpe(MonitoredProduct product) {
        if (product.getCpe() != null) {
            String[] parts = product.getCpe().split(":");
            if (parts.length >= 6 && product.getCurrentVersion() != null) {
                parts[5] = product.getCurrentVersion();
            }
            return String.join(":", parts);
        }
        if (containsIgnoreCase(product.getName(), "postgresql") && product.getCurrentVersion() != null) {
            return "cpe:2.3:a:postgresql:postgresql:" + product.getCurrentVersion() + ":*:*:*:*:*:*:*";
        }
        return null;
    }

    public List<com.sentinelcve.model.CveItem> getProductVulnerabilities(MonitoredProduct product) throws Exception {
        java.util.LinkedHashMap<String, com.sentinelcve.model.CveItem> results = new java.util.LinkedHashMap<>();
        Identity identity = packageIdentity(product);

        boolean hasVersion = product.getCurrentVersion() != null && !product.getCurrentVersion().isBlank();
        if (hasVersion && (product.getPurl() != null || "npm".equals(identity.ecosystem()) || "pypi".equals(identity.ecosystem()))) {
            String osvUrl = "https://api.osv.dev/v1/query";
            var body = mapper.createObjectNode();
            body.put("version", product.getCurrentVersion());
            if (product.getPurl() != null) {
                var pkg = mapper.createObjectNode();
                pkg.put("purl", product.getPurl().replaceFirst("@[^?]+", "@" + product.getCurrentVersion()));
                body.set("package", pkg);
            } else {
                var pkg = mapper.createObjectNode();
                pkg.put("ecosystem", "pypi".equals(identity.ecosystem()) ? "PyPI" : "npm");
                pkg.put("name", identity.name());
                body.set("package", pkg);
            }
            JsonNode osv = mapper.readTree(fetchTimed(osvUrl, "POST", body.toString(), java.util.Map.of()).body());
            for (JsonNode vuln : osv.path("vulns")) {
                String id = vuln.path("id").asText();
                for (JsonNode alias : vuln.path("aliases")) {
                    if (alias.asText("").startsWith("CVE-")) {
                        id = alias.asText();
                        break;
                    }
                }
                double severityScore = vuln.path("database_specific").path("cvss").path("score").asDouble(0);
                com.sentinelcve.model.CveItem item = new com.sentinelcve.model.CveItem();
                item.setId(id);
                item.setTitle(id + ": " + vuln.path("summary").asText("OSV vulnerability"));
                item.setDescription(vuln.path("details").asText(vuln.path("summary").asText("")));
                item.setPublishedDate(vuln.path("published").asText(null));
                item.setLastModifiedDate(vuln.path("modified").asText(null));
                item.setProductName(product.getName());
                item.setVendorName(product.getVendor());
                com.sentinelcve.model.CvssMetrics cvss = new com.sentinelcve.model.CvssMetrics();
                cvss.setBaseScore(severityScore);
                cvss.setSeverity(normalizeSeverity(vuln.path("database_specific").path("severity").asText(null)));
                cvss.setVectorString("");
                item.setCvss(cvss);
                item.setCisaKev(false);
                item.setAffectedVersions(List.of(product.getCurrentVersion()));
                item.setCpe(product.getCpe() != null ? List.of(product.getCpe()) : List.of());
                List<com.sentinelcve.model.ReferenceLink> refs = new ArrayList<>();
                for (JsonNode ref : vuln.path("references")) {
                    refs.add(new com.sentinelcve.model.ReferenceLink(ref.path("type").asText("OSV"), ref.path("url").asText(null)));
                }
                item.setReferences(refs);
                item.setDataSources(new ArrayList<>(List.of(new com.sentinelcve.model.DataSourceInfo(
                    "OSV", "https://osv.dev/vulnerability/" + vuln.path("id").asText(), Instant.now().toString()))));
                item.setMatchConfidence("HIGH");
                item.setMatchedBy("OSV_PACKAGE_VERSION");
                results.put(id, item);
            }
        }

        String cpe = resolvedCpe(product);
        if (cpe != null) {
            String sourceUrl = "https://services.nvd.nist.gov/rest/json/cves/2.0?cpeName=" +
                java.net.URLEncoder.encode(cpe, java.nio.charset.StandardCharsets.UTF_8) + "&isVulnerable";
            String nvdApiKey = System.getenv("NVD_API_KEY");
            java.util.Map<String, String> headers = (nvdApiKey != null && !nvdApiKey.isBlank())
                ? java.util.Map.of("apiKey", nvdApiKey) : java.util.Map.of();
            JsonNode nvd = mapper.readTree(fetchTimed(sourceUrl, "GET", null, headers).body());
            for (JsonNode entry : nvd.path("vulnerabilities")) {
                com.sentinelcve.model.CveItem item = nvdToCve(entry, product, sourceUrl);
                com.sentinelcve.model.CveItem existing = results.get(item.getId());
                if (existing != null) {
                    existing.getDataSources().addAll(item.getDataSources());
                } else {
                    results.put(item.getId(), item);
                }
            }
        }

        boolean hasEcosystem = identity.ecosystem() != null && !identity.ecosystem().isBlank();
        if (product.getPurl() == null && !hasEcosystem && cpe == null) {
            throw new RuntimeException("缺少可精確比對漏洞的 PURL、ecosystem/packageName 或完整 CPE。");
        }
        return new ArrayList<>(results.values());
    }
}

