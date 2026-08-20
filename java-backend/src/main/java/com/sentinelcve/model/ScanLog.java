package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors ScanLog in src/types.ts. */
@Data
@NoArgsConstructor
public class ScanLog {
    private String id;
    private String timestamp;
    private String type; // AUTO_SCAN | MANUAL_SCAN | ALERT_TRIGGER | AI_ANALYSIS | WEBHOOK_DISPATCH | SYSTEM_INFO
    private String level; // INFO | SUCCESS | WARNING | ERROR
    private String productName;
    private String message;
    private String details;
}
