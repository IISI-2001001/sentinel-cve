package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors TicketCveInfo in src/types.ts. */
@Data
@NoArgsConstructor
public class TicketCveInfo {
    private String cveId;
    private String title;
    private double cvss;
    private String severity;
    private boolean cisaKev;
    private String productName;
}
