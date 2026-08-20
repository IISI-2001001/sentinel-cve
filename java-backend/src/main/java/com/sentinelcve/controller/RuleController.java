package com.sentinelcve.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.AlertRule;
import com.sentinelcve.service.LogService;
import com.sentinelcve.service.StateService;
import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Java port of server.ts lines 1761-1801.
 */
@RestController
@RequestMapping("/api/rules")
public class RuleController {

    private final AppState state;
    private final StateService stateService;
    private final LogService logService;
    private final ObjectMapper objectMapper;

    public RuleController(AppState state, StateService stateService, LogService logService, ObjectMapper objectMapper) {
        this.state = state;
        this.stateService = stateService;
        this.logService = logService;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<?> getRules() {
        synchronized (state.lock) {
            return ResponseEntity.ok(new ArrayList<>(state.rules));
        }
    }

    @PostMapping
    public ResponseEntity<?> createRule(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        AlertRule newRule = new AlertRule();
        newRule.setId("rule-" + System.currentTimeMillis());
        newRule.setName(hasText(request.get("name")) ? String.valueOf(request.get("name")) : "Custom Alert Rule");
        newRule.setEnabled(true);
        newRule.setMinCvssScore(numberOrDefault(request.get("minCvssScore"), 7.0));
        newRule.setOnlyCisaKev(jsBoolean(request.get("onlyCisaKev")));
        newRule.setTargetProductIds(toStringList(request.get("targetProductIds")));
        newRule.setNotifyChannels(toStringList(request.get("notifyChannels")).isEmpty() ? List.of("in_app", "webhook") : toStringList(request.get("notifyChannels")));
        newRule.setCreatedAt(Instant.now().toString());

        synchronized (state.lock) {
            state.rules.add(newRule);
        }
        logService.addLog("SYSTEM_INFO", "INFO", "新增警報規則: " + newRule.getName());
        stateService.persist();
        return ResponseEntity.ok(newRule);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateRule(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body) throws Exception {
        AlertRule rule;
        synchronized (state.lock) {
            rule = state.rules.stream().filter(r -> id.equals(r.getId())).findFirst().orElse(null);
        }
        if (rule != null) {
            synchronized (state.lock) {
                objectMapper.updateValue(rule, body != null ? body : Map.of());
            }
            logService.addLog("SYSTEM_INFO", "INFO", "更新警報規則: " + rule.getName());
            stateService.persist();
        }
        return ResponseEntity.ok(rule);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRule(@PathVariable String id) {
        AlertRule deleted = null;
        synchronized (state.lock) {
            int idx = -1;
            for (int i = 0; i < state.rules.size(); i++) {
                if (id.equals(state.rules.get(i).getId())) {
                    idx = i;
                    break;
                }
            }
            if (idx != -1) deleted = state.rules.remove(idx);
        }
        if (deleted != null) {
            logService.addLog("SYSTEM_INFO", "INFO", "刪除警報規則: " + deleted.getName());
            stateService.persist();
        }
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    private static boolean hasText(Object value) {
        return value != null && !String.valueOf(value).isBlank();
    }

    private static boolean jsBoolean(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.doubleValue() != 0;
        if (value instanceof String s) return !s.isEmpty();
        return true;
    }

    private static double numberOrDefault(Object value, double defaultValue) {
        if (value == null || String.valueOf(value).isBlank()) return defaultValue;
        double parsed = value instanceof Number number ? number.doubleValue() : Double.parseDouble(String.valueOf(value));
        return parsed == 0 ? defaultValue : parsed;
    }

    private static List<String> toStringList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        return List.of();
    }
}
