package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors AlertRule in src/types.ts. */
@Data
@NoArgsConstructor
public class AlertRule {
    private String id;
    private String name;
    private boolean enabled;
    private double minCvssScore;
    private boolean onlyCisaKev;
    private List<String> targetProductIds;
    private List<String> notifyChannels; // in_app | webhook | email
    private String createdAt;
}
