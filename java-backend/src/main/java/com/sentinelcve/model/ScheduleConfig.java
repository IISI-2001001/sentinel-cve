package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors ScheduleConfig in src/types.ts. */
@Data
@NoArgsConstructor
public class ScheduleConfig {
    private boolean enabled;
    private int intervalMinutes;
    private String cronExpression;
    private String scanScope; // ALL | CRITICAL_HIGH_ONLY
    private boolean autoAiAnalysis;
    private boolean autoNotifyTeams;
    private boolean autoNotifyEmail;
    private String lastRunAt;
    private String nextRunAt;
}
