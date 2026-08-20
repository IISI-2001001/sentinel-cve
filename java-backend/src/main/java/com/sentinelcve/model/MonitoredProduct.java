package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors MonitoredProduct in src/types.ts. */
@Data
@NoArgsConstructor
public class MonitoredProduct {
    private String id;
    private String name;
    private String vendor;
    private String category; // Operating System | Web Server | Database | Framework/Library | Container/Cloud | Security/Network | Application
    private String cpeKeyword;
    private String criticality; // CRITICAL | HIGH | MEDIUM | LOW
    private boolean autoScanEnabled;
    private int scanIntervalMinutes;
    private String lastScannedAt;
    private int detectedCveCount;
    private int activeAlertCount;

    private String currentVersion;
    private String latestVersion;
    private String latestSecureVersion;
    private Boolean hasUpdateAvailable;
    private String latestReleaseDate;
    private String updateNotes;
    private String sourceType; // auto | postgresql | github | npm | pypi | vendor
    private String ecosystem;
    private String packageName;
    private String purl;
    private String cpe;
    private String repository;
    private String vendorReleaseUrl;
    private String releaseChannel; // stable | lts | prerelease
    private String versionSourceUrl;
    private String versionCheckedAt;
    private String versionConfidence; // HIGH | MEDIUM | LOW
}
