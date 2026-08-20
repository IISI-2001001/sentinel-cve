package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors CVEItem in src/types.ts. */
@Data
@NoArgsConstructor
public class CveItem {
    private String id; // e.g. CVE-2024-3094
    private String title;
    private String description;
    private String publishedDate;
    private String lastModifiedDate;
    private String productName;
    private String vendorName;
    private CvssMetrics cvss;
    private Double epssScore;
    private boolean cisaKev;
    private String cisaKevDueDate;
    private List<String> affectedVersions;
    private List<String> cpe;
    private List<ReferenceLink> references;
    private List<DataSourceInfo> dataSources;
    private String matchConfidence; // HIGH | MEDIUM | LOW
    private String matchedBy;
    private AiAnalysis aiAnalysis;
}
