package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors WebhookConfig in src/types.ts. */
@Data
@NoArgsConstructor
public class WebhookConfig {
    private String id;
    private String name;
    private String type; // slack | teams | discord | custom
    private String url;
    private boolean enabled;
    private String secretKey;
    private String lastTestedAt;
    private String lastStatus; // SUCCESS | FAILED
}
