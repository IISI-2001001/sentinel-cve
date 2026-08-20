package com.sentinelcve.controller;

import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;

/**
 * Java port of server.ts lines 1857-1860.
 */
@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final AppState state;

    public LogController(AppState state) {
        this.state = state;
    }

    @GetMapping
    public ResponseEntity<?> getLogs() {
        synchronized (state.lock) {
            return ResponseEntity.ok(new ArrayList<>(state.logs));
        }
    }
}
