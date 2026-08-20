package com.sentinelcve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.*;
import com.sentinelcve.state.AppState;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Java port of the AI ticket-generation logic in POST /api/projects/:id/generate-ticket
 * (server.ts). Builds the CISO/red-team/compliance prompt, calls AiService, and assembles a
 * Ticket from the AI's JSON response (with sane fallbacks if a field is missing). */
@Service
public class TicketService {

    private final AppState state;
    private final AiService aiService;
    private final LogService logService;
    private final ObjectMapper mapper;

    public TicketService(AppState state, AiService aiService, LogService logService, ObjectMapper mapper) {
        this.state = state;
        this.aiService = aiService;
        this.logService = logService;
        this.mapper = mapper;
    }

    public Ticket generateTicketForProject(Project prj) throws Exception {
        List<MonitoredProduct> prjProducts;
        synchronized (state.lock) {
            prjProducts = state.products.stream().filter(p -> prj.getProductIds().contains(p.getId())).toList();
        }
        if (prjProducts.isEmpty()) {
            throw new IllegalArgumentException("該專案未繫結任何監控產品資產");
        }

        List<String> prjProductNames = prjProducts.stream().map(p -> p.getName().toLowerCase(Locale.ROOT)).toList();
        List<String> prjCpeKeywords = prjProducts.stream().map(p -> p.getCpeKeyword().toLowerCase(Locale.ROOT)).toList();

        List<CveItem> relevantCves;
        synchronized (state.lock) {
            relevantCves = state.cvesDatabase.stream().filter(cve -> {
                String pName = cve.getProductName().toLowerCase(Locale.ROOT);
                return prjProductNames.stream().anyMatch(pName::contains) || prjCpeKeywords.stream().anyMatch(pName::contains);
            }).toList();
        }
        List<CveItem> activeCveList;
        synchronized (state.lock) {
            activeCveList = !relevantCves.isEmpty() ? relevantCves
                : state.cvesDatabase.subList(0, Math.min(2, state.cvesDatabase.size()));
        }

        double maxCvss = activeCveList.stream().mapToDouble(c -> c.getCvss().getBaseScore()).max().orElse(0);
        String priority;
        int slaHours;
        if (maxCvss >= 9.0) {
            priority = "CRITICAL";
            slaHours = 24;
        } else if (maxCvss >= 7.0) {
            priority = "HIGH";
            slaHours = 72;
        } else if (maxCvss >= 4.0) {
            priority = "MEDIUM";
            slaHours = 168;
        } else {
            priority = "LOW";
            slaHours = 336;
        }

        String slaDeadline = Instant.now().plusSeconds(slaHours * 3600L).toString();
        String ticketNo = "TKT-" + prj.getCode().toUpperCase(Locale.ROOT) + "-" + java.time.Year.now().getValue() + "-" + (100 + (int) (Math.random() * 900));
        AiConfig aiConfig = state.currentAiConfig;
        String activeModel = aiConfig.getModel() != null ? aiConfig.getModel() : "gemini-3.6-flash";

        String rolePrompt = "你是一位 DevSecOps 安全防護架構師與資安事件應變隊長。";
        if ("redteam".equals(aiConfig.getPromptPreset())) {
            rolePrompt = "你是一位頂尖紅隊攻擊專家，著重於釐清攻防利用路徑與加固手段。";
        } else if ("compliance".equals(aiConfig.getPromptPreset())) {
            rolePrompt = "你是一位資安稽核顧問，專注於產生符合 ISO 27001 規範的資安矯正單。";
        } else if ("custom".equals(aiConfig.getPromptPreset()) && aiConfig.getCustomSystemPrompt() != null && !aiConfig.getCustomSystemPrompt().isBlank()) {
            rolePrompt = aiConfig.getCustomSystemPrompt();
        }

        StringBuilder cveListBlock = new StringBuilder();
        for (CveItem c : activeCveList) {
            cveListBlock.append("- [").append(c.getId()).append("] ").append(c.getProductName()).append(": CVSS ")
                .append(c.getCvss().getBaseScore()).append(" (").append(c.getCvss().getSeverity()).append(") | CISA KEV: ")
                .append(c.isCisaKev() ? "是" : "否").append(" | 標題: ").append(c.getTitle()).append("\n");
        }

        String prompt = rolePrompt + "\n請為以下專案生成一份極致專業、可執行的「專案 CVE 漏洞資安修補處置工單 (Remediation Ticket / Work Order)」：\n\n"
            + "[專案資訊]\n"
            + "- 專案名稱: " + prj.getName() + " (代號: " + prj.getCode() + ")\n"
            + "- 隸屬部門: " + prj.getDepartment() + "\n"
            + "- 專案負責人: " + prj.getOwnerName() + " (" + prj.getOwnerEmail() + ")\n"
            + "- 受影響產品資產: " + String.join(", ", prjProducts.stream().map(MonitoredProduct::getName).toList()) + "\n\n"
            + "[發現之資安漏洞清單 (共 " + activeCveList.size() + " 個)]\n" + cveListBlock
            + "\n請以 JSON 格式 (繁體中文) 輸出，結構如下：\n"
            + "{\n  \"title\": \"簡短且明確的工單主題標題\",\n  \"executiveSummary\": \"針對此專案影響範疇的高階威脅摘要 (100字以內)\",\n"
            + "  \"rootCauseAnalysis\": \"漏洞發生的底層技術根因剖析\",\n  \"actionSteps\": [\n"
            + "    {\n      \"stepNumber\": 1,\n      \"title\": \"步驟1標題 (例如: 環境版本檢視)\",\n"
            + "      \"detail\": \"步驟1具體說明與操作指引\",\n      \"commandSnippet\": \"可執行之 Linux / CLI / Docker 命令行或 API 驗證語法 (選填)\"\n    },\n"
            + "    {\n      \"stepNumber\": 2,\n      \"title\": \"步驟2標題 (例如: 套件升級或 Patch 套用)\",\n"
            + "      \"detail\": \"步驟2具體說明\",\n      \"commandSnippet\": \"修補指令\"\n    }\n  ],\n"
            + "  \"mitigationPlan\": \"若無法立即升級重構時的臨時替代規避方案 (Workaround / WAF 規則 / IP 隔離)\",\n"
            + "  \"verificationMethod\": \"修補完成後的驗證指引與安全複查步驟\"\n}";

        try {
            String aiText = aiService.generateAiText(prompt, aiConfig, true);
            JsonNode aiParsed = mapper.readTree(aiText);

            Ticket ticket = new Ticket();
            ticket.setId("tkt-" + System.currentTimeMillis());
            ticket.setTicketNo(ticketNo);
            ticket.setProjectId(prj.getId());
            ticket.setProjectCode(prj.getCode());
            ticket.setProjectName(prj.getName());
            ticket.setDepartment(prj.getDepartment());
            ticket.setTitle(aiParsed.path("title").asText("【安全修補】" + prj.getName() + " 專案 CVE 漏洞處置工單"));
            ticket.setPriority(priority);
            ticket.setStatus("OPEN");
            ticket.setAssigneeName(prj.getOwnerName());
            ticket.setAssigneeEmail(prj.getOwnerEmail());
            ticket.setAffectedProducts(prjProducts.stream().map(MonitoredProduct::getName).toList());
            ticket.setCveCount(activeCveList.size());
            List<TicketCveInfo> cveInfos = new ArrayList<>();
            for (CveItem c : activeCveList) {
                TicketCveInfo info = new TicketCveInfo();
                info.setCveId(c.getId());
                info.setTitle(c.getTitle());
                info.setCvss(c.getCvss().getBaseScore());
                info.setSeverity(c.getCvss().getSeverity());
                info.setCisaKev(c.isCisaKev());
                info.setProductName(c.getProductName());
                cveInfos.add(info);
            }
            ticket.setCveList(cveInfos);
            ticket.setSlaHours(slaHours);
            ticket.setSlaDeadline(slaDeadline);
            ticket.setAiModelUsed(aiConfig.getProvider() + "/" + activeModel);
            ticket.setExecutiveSummary(aiParsed.path("executiveSummary").asText(
                "專案「" + prj.getName() + "」發現 " + activeCveList.size() + " 個待修補漏洞，需儘速完成安全檢視。"));
            ticket.setRootCauseAnalysis(aiParsed.path("rootCauseAnalysis").asText("底層套件版本過舊或缺乏邊界防禦控制機制。"));

            List<ActionStep> steps = new ArrayList<>();
            if (aiParsed.has("actionSteps") && aiParsed.get("actionSteps").isArray() && aiParsed.get("actionSteps").size() > 0) {
                for (JsonNode s : aiParsed.get("actionSteps")) {
                    ActionStep step = new ActionStep();
                    step.setStepNumber(s.path("stepNumber").asInt());
                    step.setTitle(s.path("title").asText());
                    step.setDetail(s.path("detail").asText());
                    step.setCommandSnippet(s.path("commandSnippet").asText(null));
                    steps.add(step);
                }
            } else {
                ActionStep s1 = new ActionStep();
                s1.setStepNumber(1);
                s1.setTitle("清查並確認受影響產品版本");
                s1.setDetail("針對專案綁定之資產 (" + String.join(", ", prjProducts.stream().map(MonitoredProduct::getName).toList()) + ") 進行版號清查。");
                s1.setCommandSnippet("apt list --installed | grep -E \"openssl|linux|docker\"");
                ActionStep s2 = new ActionStep();
                s2.setStepNumber(2);
                s2.setTitle("更新與驗證安全修補");
                s2.setDetail("安裝最新釋出之 LTS 修補版本套件並重啟服務驗證。");
                s2.setCommandSnippet("sudo apt-get update && sudo apt-get upgrade");
                steps.add(s1);
                steps.add(s2);
            }
            ticket.setActionSteps(steps);
            ticket.setMitigationPlan(aiParsed.path("mitigationPlan").asText("於前端 WAF 設定封包過濾規則並進行存取控制隔離。"));
            ticket.setVerificationMethod(aiParsed.path("verificationMethod").asText("執行漏洞掃描工具複查，確認無高危風險項目後結案。"));
            ticket.setCreatedAt(Instant.now().toString());
            ticket.setUpdatedAt(Instant.now().toString());

            synchronized (state.lock) {
                state.tickets.add(0, ticket);
            }

            logService.addLog("AI_ANALYSIS", "SUCCESS",
                "AI [" + aiConfig.getProvider() + "/" + activeModel + "] 已產出專案「" + prj.getName() + "」修補工單: " + ticket.getTicketNo(),
                prj.getName(), "優先級: " + ticket.getPriority() + ", SLA: " + slaHours + "h, CVE: " + ticket.getCveCount() + " 項");

            return ticket;
        } catch (Exception err) {
            logService.addLog("AI_ANALYSIS", "ERROR", "AI 工單產生失敗: " + (err.getMessage() != null ? err.getMessage() : "未知錯誤"), prj.getName());
            throw err;
        }
    }
}
