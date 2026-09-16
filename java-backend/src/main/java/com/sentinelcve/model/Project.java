package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors Project in src/types.ts. */
@Data
@NoArgsConstructor
public class Project {
    private String id;
    private String code;
    private String name;
    private String description;
    private String department;
    private String ownerName;
    private String ownerEmail;
    private List<String> secondaryContacts;
    private List<String> productIds;
    private List<ProjectProductBinding> productBindings;
    private List<String> deploymentEnvironments; // 此專案可用的部署環境清單（各客戶/專案不同，預設 DEV/SIT/UAT/PRD）
    private boolean notifyEmail;
    private String notifyFrequency; // REALTIME | EVERY_15_MIN | HOURLY | DAILY | WEEKLY
    private Boolean versionNotifyEnabled;
    private String versionNotifyFrequency;
    private String versionNotifyLastRunAt;
    private String versionNotifyNextRunAt;
    private String versionNotifyLastSignature;
    private Boolean cveNotifyEnabled;
    private String cveNotifyFrequency;
    private String cveNotifyLastRunAt;
    private String cveNotifyNextRunAt;
    private String cveNotifyLastSignature;
    private String teamsWebhookUrl;
    private String ownerTeamsWebhookUrl;
    private String handlerName;
    private String handlerTeamsWebhookUrl;
    private double notifyMinCvss;
    private boolean notifyCisaKevOnly;
    private String createdAt;
    private String updatedAt;
}
