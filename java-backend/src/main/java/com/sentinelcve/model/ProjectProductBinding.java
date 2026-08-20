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
}
