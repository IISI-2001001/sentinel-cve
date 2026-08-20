package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors CVEItem.aiAnalysis in src/types.ts. */
@Data
@NoArgsConstructor
public class AiAnalysis {
    private String summary;
    private String impactLevel; // CRITICAL | HIGH | MEDIUM | LOW
    private String attackScenario;
    private List<String> mitigationSteps;
    private String workaround;
    private String executiveAdvisory;
    private String analyzedAt;
}
