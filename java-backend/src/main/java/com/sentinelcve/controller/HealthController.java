package com.sentinelcve.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;

/**
 * Java port of server.ts lines 720-724.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<?> getHealth() {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(body);
    }
}
