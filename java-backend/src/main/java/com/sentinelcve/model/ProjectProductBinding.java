package com.sentinelcve.model;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors ProjectProductBinding in src/types.ts. */
@Data
@NoArgsConstructor
public class ProjectProductBinding {
    private String productId;
    private String productName;
    private String vendor;
    private String cpeKeyword;
    private String targetVersion;
    private String environment; // Production | Staging | Testing | Development
    private String customNotes;
    private String boundAt;

    // Base CPE (version wildcarded, e.g. cpe:2.3:a:f5:nginx:*:*:*:*:*:*:*:*) captured from the
    // global product catalog (product_cpe_cache) at bind-time; combined with targetVersion at
    // scan-time to build an exact NVD cpeName match string for this project's specific usage.
    private String productCpe;
    private boolean autoScanEnabled = true;
    private int scanIntervalMinutes = 1440;
    private String lastScannedAt;
    private int detectedCveCount;
    private int activeAlertCount;

    // Full snapshot of CVEs found by the most recent scan of this specific binding (product +
    // target version + environment). Overwritten wholesale on every successful scan (not merged),
    // so this list correctly reflects only CVEs currently affecting this project's exact usage,
    // isolating it from other projects/bindings that may use the same product at a different
    // version. The global cvesDatabase remains a separate, cross-project aggregate used by the
    // CVE Center browsing page and is not affected by this field.
    private List<CveItem> cves = new ArrayList<>();
}
