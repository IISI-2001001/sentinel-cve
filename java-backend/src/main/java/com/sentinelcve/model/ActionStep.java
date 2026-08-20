package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors ActionStep in src/types.ts. */
@Data
@NoArgsConstructor
public class ActionStep {
    private int stepNumber;
    private String title;
    private String detail;
    private String commandSnippet;
}
