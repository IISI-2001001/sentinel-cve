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
    private String scanScope; // ALL
    private boolean autoNotifyTeams;
    private boolean autoNotifyEmail;
    private String lastRunAt;
    private String nextRunAt;

    // CPE 對照自動更新排程：獨立於上方的弱點掃描排程，定期檢查「產品管理」頁面
    // (product_cpe_cache) 已儲存的每個產品是否有新的 NVD CPE 識別碼。
    private boolean cpeAutoUpdateEnabled;
    private int cpeUpdateIntervalMinutes; // e.g. 360, 720, 1440
    private String cpeLastRunAt;
    private String cpeNextRunAt;
}
