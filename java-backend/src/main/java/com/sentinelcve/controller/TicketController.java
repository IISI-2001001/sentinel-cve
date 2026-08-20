package com.sentinelcve.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.ActionStep;
import com.sentinelcve.model.EmailNotificationConfig;
import com.sentinelcve.model.Project;
import com.sentinelcve.model.Ticket;
import com.sentinelcve.model.TicketCveInfo;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.MailService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.service.TicketService;
import com.sentinelcve.state.AppState;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/** Java port of server.ts lines 974-1244. */
@RestController
@RequestMapping("/api")
public class TicketController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final MailService mailService;
    private final TicketService ticketService;
    private final ObjectMapper mapper;

    public TicketController(AppState state, StateService stateService, LogService logService,
                            MailService mailService, TicketService ticketService, ObjectMapper mapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.mailService = mailService;
        this.ticketService = ticketService;
        this.mapper = mapper;
    }

    @GetMapping("/tickets")
    public List<Ticket> listTickets(@RequestParam(required = false) String projectId) {
        synchronized (state.lock) {
            if (projectId != null) {
                return new ArrayList<>(state.tickets.stream().filter(ticket -> projectId.equals(ticket.getProjectId())).toList());
            }
            return new ArrayList<>(state.tickets);
        }
    }

    @PostMapping("/tickets")
    public Ticket createTicket(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = safeBody(body);
        int slaHours = intOrDefault(payload.get("slaHours"), 72);
        String now = Instant.now().toString();

        String aiModelUsed;
        synchronized (state.lock) {
            aiModelUsed = nonBlank(state.currentAiConfig.getModel(), "gemini-3.6-flash");
        }

        Ticket newTicket = new Ticket();
        newTicket.setId("tkt-" + System.currentTimeMillis() + "-" + randomBase36(4));
        newTicket.setTicketNo(nonBlank(asString(payload.get("ticketNo")), "TKT-" + ThreadLocalRandom.current().nextInt(1000, 10000)));
        newTicket.setProjectId(nonBlank(asString(payload.get("projectId")), ""));
        newTicket.setProjectCode(nonBlank(asString(payload.get("projectCode")), "PRJ"));
        newTicket.setProjectName(nonBlank(asString(payload.get("projectName")), "未指定專案"));
        newTicket.setDepartment(nonBlank(asString(payload.get("department")), "DevSecOps"));
        newTicket.setTitle(nonBlank(asString(payload.get("title")), "資安修補處置單"));
        newTicket.setPriority(nonBlank(asString(payload.get("priority")), "HIGH"));
        newTicket.setStatus(nonBlank(asString(payload.get("status")), "OPEN"));
        newTicket.setAssigneeName(nonBlank(asString(payload.get("assigneeName")), "專案負責人"));
        newTicket.setAssigneeEmail(nonBlank(asString(payload.get("assigneeEmail")), ""));
        newTicket.setAffectedProducts(stringListOrDefault(payload.get("affectedProducts")));
        newTicket.setCveCount(intOrDefault(payload.get("cveCount"), 1));
        newTicket.setCveList(cveListOrDefault(payload.get("cveList")));
        newTicket.setSlaHours(slaHours);
        newTicket.setSlaDeadline(nonBlank(asString(payload.get("slaDeadline")), Instant.now().plusSeconds(slaHours * 3600L).toString()));
        newTicket.setAiModelUsed(nonBlank(asString(payload.get("aiModelUsed")), aiModelUsed));
        newTicket.setExecutiveSummary(nonBlank(asString(payload.get("executiveSummary")), "經評估進行專案套件版本升級或受影響資產 CVE 弱點修補處置。"));
        newTicket.setRootCauseAnalysis(nonBlank(asString(payload.get("rootCauseAnalysis")), "受監控軟體套件存在已知 CVE 弱點或版本過舊，需派發修補工單指派專人處理。"));
        newTicket.setActionSteps(actionStepsOrDefault(payload.get("actionSteps")));
        newTicket.setMitigationPlan(nonBlank(asString(payload.get("mitigationPlan")), "執行安全版本更新與防禦控制。"));
        newTicket.setVerificationMethod(nonBlank(asString(payload.get("verificationMethod")), "執行 SentinelCVE 複測掃描與 Log 核驗。"));
        newTicket.setCreatedAt(now);
        newTicket.setUpdatedAt(now);

        synchronized (state.lock) {
            state.tickets.add(0, newTicket);
        }

        logService.addLog(
            "SYSTEM_INFO",
            "INFO",
            "建立新修補工單 [" + newTicket.getTicketNo() + "]: " + newTicket.getTitle() + " (指派對象: " + newTicket.getAssigneeName() + ")",
            newTicket.getProjectName()
        );
        stateService.persist();
        return newTicket;
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<?> getTicket(@PathVariable String id) {
        synchronized (state.lock) {
            Ticket ticket = state.tickets.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
            if (ticket == null) {
                return error(HttpStatus.NOT_FOUND, "工單不存在");
            }
            return ResponseEntity.ok(ticket);
        }
    }

    @PutMapping("/tickets/{id}")
    public ResponseEntity<?> updateTicket(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = safeBody(body);
        Ticket ticket;
        synchronized (state.lock) {
            ticket = state.tickets.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
            if (ticket == null) {
                return error(HttpStatus.NOT_FOUND, "工單不存在");
            }

            if ("RESOLVED".equals(asString(payload.get("status")))
                && nonBlank(asString(payload.get("resolutionNote")), nonBlank(ticket.getResolutionNote(), "")).isBlank()) {
                return error(HttpStatus.BAD_REQUEST, "工單標記為已解決前，必須填寫處理說明。");
            }

            try {
                mapper.updateValue(ticket, payload);
            } catch (Exception ex) {
                throw new RuntimeException(ex);
            }
            ticket.setUpdatedAt(Instant.now().toString());
        }

        logService.addLog(
            "SYSTEM_INFO",
            "INFO",
            "更新專案工單狀態 [" + ticket.getTicketNo() + "]: " + ticket.getStatus(),
            ticket.getProjectName()
        );
        stateService.persist();
        return ResponseEntity.ok(ticket);
    }

    @DeleteMapping("/tickets/{id}")
    public Map<String, Object> deleteTicket(@PathVariable String id) {
        Ticket removed = null;
        synchronized (state.lock) {
            int idx = -1;
            for (int i = 0; i < state.tickets.size(); i++) {
                if (id.equals(state.tickets.get(i).getId())) {
                    idx = i;
                    break;
                }
            }
            if (idx != -1) {
                removed = state.tickets.remove(idx);
            }
        }

        if (removed != null) {
            logService.addLog("SYSTEM_INFO", "INFO", "刪除專案修補工單: " + removed.getTicketNo(), removed.getProjectName());
            stateService.persist();
        }
        return success(true);
    }

    @PostMapping("/tickets/{id}/email")
    public ResponseEntity<?> sendTicketEmail(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = safeBody(body);
        Ticket ticket;
        EmailNotificationConfig emailConfig;
        synchronized (state.lock) {
            ticket = state.tickets.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
            emailConfig = mapper.convertValue(state.emailConfig, EmailNotificationConfig.class);
        }
        if (ticket == null) {
            return error(HttpStatus.NOT_FOUND, "工單不存在");
        }

        String recipient = nonBlank(asString(payload.get("recipientEmail")), ticket.getAssigneeEmail());
        if (isBlank(recipient) || isBlank(emailConfig.getSmtpServer()) || isBlank(emailConfig.getSenderEmail())) {
            return error(HttpStatus.BAD_REQUEST, "SMTP 或工單收件者尚未設定完整。", false);
        }

        try {
            mailService.sendMail(
                emailConfig,
                recipient,
                "[" + ticket.getPriority() + "] SentinelCVE 修補工單 " + ticket.getTicketNo(),
                ticket.getTitle() + "\n\n專案：" + ticket.getProjectName() + "\n狀態：" + ticket.getStatus()
                    + "\n優先級：" + ticket.getPriority() + "\n\n" + nonBlank(ticket.getExecutiveSummary(), "")
            );
            logService.addLog(
                "WEBHOOK_DISPATCH",
                "SUCCESS",
                "[Email 派送工單] 已派發安全修補工單 [" + ticket.getTicketNo() + "] 至 <" + recipient + ">",
                ticket.getProjectName()
            );

            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("sentTo", recipient);
            response.put("ticketNo", ticket.getTicketNo());
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            logService.addLog(
                "WEBHOOK_DISPATCH",
                "ERROR",
                "[Email 派送工單失敗] " + safeMessage(err, "SMTP 錯誤"),
                ticket.getProjectName()
            );
            return error(HttpStatus.BAD_GATEWAY, safeMessage(err, "SMTP 寄送失敗"), false);
        }
    }

    @PostMapping("/projects/{id}/generate-ticket")
    public ResponseEntity<?> generateTicket(@PathVariable String id) {
        Project project;
        synchronized (state.lock) {
            project = state.projects.stream().filter(item -> id.equals(item.getId())).findFirst().orElse(null);
        }
        if (project == null) {
            return error(HttpStatus.NOT_FOUND, "專案不存在");
        }

        try {
            Ticket ticket = ticketService.generateTicketForProject(project);
            stateService.persist();
            return ResponseEntity.ok(ticket);
        } catch (IllegalArgumentException err) {
            return error(HttpStatus.BAD_REQUEST, safeMessage(err, "該專案未繫結任何監控產品資產"));
        } catch (Exception err) {
            return error(HttpStatus.BAD_GATEWAY, safeMessage(err, "AI 工單產生失敗"), false);
        }
    }

    private static Map<String, Object> safeBody(Map<String, Object> body) {
        return body != null ? body : Map.of();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String nonBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private int intOrDefault(Object value, int fallback) {
        if (value == null) return fallback;
        try {
            int parsed = value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
            return parsed == 0 ? fallback : parsed;
        } catch (Exception ex) {
            return fallback;
        }
    }

    private List<String> stringListOrDefault(Object value) {
        if (!(value instanceof List<?> list)) {
            return new ArrayList<>();
        }
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            result.add(String.valueOf(item));
        }
        return result;
    }

    private List<TicketCveInfo> cveListOrDefault(Object value) {
        if (value == null) {
            return new ArrayList<>();
        }
        return mapper.convertValue(value, new TypeReference<List<TicketCveInfo>>() {});
    }

    private List<ActionStep> actionStepsOrDefault(Object value) {
        if (value != null) {
            List<ActionStep> steps = mapper.convertValue(value, new TypeReference<List<ActionStep>>() {});
            if (steps != null && !steps.isEmpty()) {
                return steps;
            }
        }

        List<ActionStep> defaults = new ArrayList<>();

        ActionStep step1 = new ActionStep();
        step1.setStepNumber(1);
        step1.setTitle("套件備份與環境驗證");
        step1.setDetail("執行系統組態備份與測試環境測試。");
        defaults.add(step1);

        ActionStep step2 = new ActionStep();
        step2.setStepNumber(2);
        step2.setTitle("修補升級套用");
        step2.setDetail("依據建議升級版本進行套件升級與部署。");
        defaults.add(step2);

        ActionStep step3 = new ActionStep();
        step3.setStepNumber(3);
        step3.setTitle("功能測試與資安複測");
        step3.setDetail("執行部署後功能與資安掃描複測。");
        defaults.add(step3);

        return defaults;
    }

    private static String randomBase36(int length) {
        String value = Integer.toString(ThreadLocalRandom.current().nextInt((int) Math.pow(36, length)), 36);
        return "0".repeat(Math.max(0, length - value.length())) + value;
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        return error(status, message, null);
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message, Boolean success) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        if (success != null) {
            body.put("success", success);
        }
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }

    private static Map<String, Object> success(boolean success) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("success", success);
        return body;
    }

    private static String safeMessage(Exception err, String fallback) {
        return err.getMessage() != null ? err.getMessage() : fallback;
    }
}
