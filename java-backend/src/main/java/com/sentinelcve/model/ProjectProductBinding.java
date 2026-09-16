package com.sentinelcve.model;

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
}
