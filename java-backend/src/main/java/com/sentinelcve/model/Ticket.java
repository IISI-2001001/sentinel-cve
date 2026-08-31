package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors Ticket in src/types.ts. */
@Data
@NoArgsConstructor
public class Ticket {
    private String id;
    private String ticketNo;
    private String projectId;
    private String projectCode;
    private String projectName;
    private String department;
    private String title;
    private String priority;
    private String status;
    private String assigneeName;
    private String assigneeEmail;
    private List<String> affectedProducts;
    private int cveCount;
    private List<TicketCveInfo> cveList;
    private int slaHours;
    private String slaDeadline;
    private String executiveSummary;
    private String rootCauseAnalysis;
    private List<ActionStep> actionSteps;
    private String mitigationPlan;
    private String verificationMethod;
    private String waiveReason;
    private String waivedBy;
    private String waivedAt;
    private String resolvedAt;
    private String resolutionNote;
    private List<TicketHistoryLog> executionHistory;
    private String createdAt;
    private String updatedAt;
}
