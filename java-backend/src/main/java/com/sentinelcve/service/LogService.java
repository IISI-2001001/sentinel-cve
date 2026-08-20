package com.sentinelcve.service;

import com.sentinelcve.model.ScanLog;
import com.sentinelcve.state.AppState;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/** Java port of the addLog() helper in server.ts. */
@Service
public class LogService {

    private final AppState state;
    private final StateService stateService;

    public LogService(AppState state, StateService stateService) {
        this.state = state;
        this.stateService = stateService;
    }

    public ScanLog addLog(String type, String level, String message) {
        return addLog(type, level, message, null, null);
    }

    public ScanLog addLog(String type, String level, String message, String productName) {
        return addLog(type, level, message, productName, null);
    }

    public ScanLog addLog(String type, String level, String message, String productName, String details) {
        ScanLog newLog = new ScanLog();
        newLog.setId("log-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 4));
        newLog.setTimestamp(Instant.now().toString());
        newLog.setType(type);
        newLog.setLevel(level);
        newLog.setProductName(productName);
        newLog.setMessage(message);
        newLog.setDetails(details);

        synchronized (state.lock) {
            state.logs.add(0, newLog);
            if (state.logs.size() > 200) {
                state.logs = new java.util.ArrayList<>(state.logs.subList(0, 200));
            }
        }
        stateService.persist();
        return newLog;
    }
}
