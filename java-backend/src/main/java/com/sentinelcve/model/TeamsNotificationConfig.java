package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors TeamsNotificationConfig in src/types.ts. */
@Data
@NoArgsConstructor
public class TeamsNotificationConfig {
    private String webhookUrl;
    private String channelName;
    private boolean enabled;
    private double minCvssScore;
    private boolean notifyCisaKevOnly;
    private String botDisplayName;
}
