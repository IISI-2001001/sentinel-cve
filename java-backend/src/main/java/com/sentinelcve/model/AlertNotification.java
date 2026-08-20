package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors AlertNotification in src/types.ts. */
@Data
@NoArgsConstructor
public class AlertNotification {
    private String id;
    private String cveId;
    private String cveTitle;
    private String productName;
    private double cvssScore;
    private String severity;
    private boolean cisaKev;
    private String message;
    private String ruleName;
    private String status; // UNREAD | ACKNOWLEDGED | RESOLVED
    private String timestamp;
    private List<String> channelDispatched;
}
