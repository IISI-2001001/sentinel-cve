package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors CVSSv3Metrics in src/types.ts. */
@Data
@NoArgsConstructor
public class CvssMetrics {
    private double baseScore;
    private String severity; // CRITICAL | HIGH | MEDIUM | LOW
    private String vectorString;
    private String attackVector;
    private String attackComplexity;
    private String privilegesRequired;
    private String userInteraction;
    private String scope;
    private String confidentialityImpact;
    private String integrityImpact;
    private String availabilityImpact;
}
