package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors TicketHistoryLog in src/types.ts. */
@Data
@NoArgsConstructor
public class TicketHistoryLog {
    private String id;
    private String timestamp;
    private String operator;
    private String fromStatus;
    private String toStatus;
    private String note;
    private String actionTitle;
}
