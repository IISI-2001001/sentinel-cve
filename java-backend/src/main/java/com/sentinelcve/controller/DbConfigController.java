package com.sentinelcve.controller;

import com.sentinelcve.config.DbConfigFileStore;
import com.sentinelcve.db.DatabaseUrlUtil;
import com.sentinelcve.service.LogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Connection;
import java.sql.DriverManager;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Manages the PostgreSQL connection settings from 系統管理 &gt; 資料庫連線. Unlike other
 * system-config controllers, the saved value is deliberately NOT stored in the application's own
 * database (that would be a chicken-and-egg problem when the very connection being changed is
 * broken) — it is written to a local file (see {@link DbConfigFileStore}) that {@code
 * DataSourceConfig} reads on startup, taking priority over the DATABASE_URL environment
 * variable. A backend restart is always required for a saved change to take effect.
 */
@RestController
@RequestMapping("/api/system/db-config")
public class DbConfigController {

    private final LogService logService;

    public DbConfigController(LogService logService) {
        this.logService = logService;
    }

    @GetMapping
    public ResponseEntity<?> getConfig() {
        try {
            String fileUrl = DbConfigFileStore.readDatabaseUrl();
            String envUrl = System.getenv("DATABASE_URL");
            String source = fileUrl != null ? "config-file" : (envUrl != null && !envUrl.isBlank() ? "env" : "default");
            String activeUrl = fileUrl != null ? fileUrl : envUrl;

            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            if (activeUrl != null && !activeUrl.isBlank()) {
                DatabaseUrlUtil.Parsed parsed = DatabaseUrlUtil.parse(activeUrl);
                response.put("host", parsed.host());
                response.put("port", parsed.port());
                response.put("database", parsed.database());
                response.put("username", parsed.username());
                response.put("passwordSet", parsed.password() != null && !parsed.password().isBlank());
            } else {
                response.put("host", System.getenv().getOrDefault("PGHOST", "localhost"));
                response.put("port", Integer.parseInt(System.getenv().getOrDefault("PGPORT", "5432")));
                response.put("database", System.getenv().getOrDefault("PGDATABASE", "sentinel_cve"));
                response.put("username", System.getenv().getOrDefault("PGUSER", "postgres"));
                response.put("passwordSet", System.getenv("PGPASSWORD") != null);
            }
            response.put("source", source);
            response.put("updatedAt", DbConfigFileStore.readUpdatedAt());
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            return ResponseEntity.status(500).body(Map.of("message", "讀取資料庫連線設定失敗：" + safeMessage(err)));
        }
    }

    @PutMapping
    public ResponseEntity<?> updateConfig(@RequestBody Map<String, Object> body) {
        try {
            String host = String.valueOf(body.getOrDefault("host", "")).trim();
            int port = toInt(body.get("port"), 5432);
            String database = String.valueOf(body.getOrDefault("database", "")).trim();
            String username = String.valueOf(body.getOrDefault("username", "")).trim();
            Object rawPassword = body.get("password");
            String password = rawPassword == null ? "" : String.valueOf(rawPassword);

            if (host.isEmpty() || database.isEmpty() || username.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("message", "host、database、username 為必填欄位"));
            }

            // Preserve the previously saved password when the field is left blank (masked in UI).
            if (password.isEmpty()) {
                String existingUrl = DbConfigFileStore.readDatabaseUrl();
                if (existingUrl != null) {
                    password = DatabaseUrlUtil.parse(existingUrl).password();
                }
            }

            String databaseUrl = DatabaseUrlUtil.build(host, port, database, username, password);
            DbConfigFileStore.write(databaseUrl);

            logService.addLog("SYSTEM_INFO", "INFO",
                "已更新資料庫連線設定 (" + host + ":" + port + "/" + database + ")，需重新啟動後端服務才會生效",
                "資料庫連線設定");

            LinkedHashMap<String, Object> response = new LinkedHashMap<>();
            response.put("host", host);
            response.put("port", port);
            response.put("database", database);
            response.put("username", username);
            response.put("passwordSet", password != null && !password.isBlank());
            response.put("source", "config-file");
            response.put("updatedAt", DbConfigFileStore.readUpdatedAt());
            response.put("restartRequired", true);
            return ResponseEntity.ok(response);
        } catch (Exception err) {
            return ResponseEntity.status(500).body(Map.of("message", "儲存資料庫連線設定失敗：" + safeMessage(err)));
        }
    }

    /** Tests a candidate connection directly via JDBC without touching the live connection
     * pool. If any field is omitted, falls back to the currently saved/active value so callers
     * can test after only changing e.g. the password. */
    @PostMapping("/test")
    public ResponseEntity<?> testConnection(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> request = body != null ? body : Map.of();
        LinkedHashMap<String, Object> response = new LinkedHashMap<>();
        try {
            String activeUrl = DbConfigFileStore.readDatabaseUrl();
            if (activeUrl == null) activeUrl = System.getenv("DATABASE_URL");
            DatabaseUrlUtil.Parsed current = (activeUrl != null && !activeUrl.isBlank())
                ? DatabaseUrlUtil.parse(activeUrl)
                : new DatabaseUrlUtil.Parsed(
                    System.getenv().getOrDefault("PGHOST", "localhost"),
                    Integer.parseInt(System.getenv().getOrDefault("PGPORT", "5432")),
                    System.getenv().getOrDefault("PGDATABASE", "sentinel_cve"),
                    System.getenv().getOrDefault("PGUSER", "postgres"),
                    System.getenv().getOrDefault("PGPASSWORD", "postgres"));

            String host = request.containsKey("host") ? String.valueOf(request.get("host")).trim() : current.host();
            int port = request.containsKey("port") ? toInt(request.get("port"), current.port()) : current.port();
            String database = request.containsKey("database") ? String.valueOf(request.get("database")).trim() : current.database();
            String username = request.containsKey("username") ? String.valueOf(request.get("username")).trim() : current.username();
            String password = request.containsKey("password") && !String.valueOf(request.get("password")).isBlank()
                ? String.valueOf(request.get("password"))
                : current.password();

            String jdbcUrl = DatabaseUrlUtil.toJdbcUrl(host, port, database);
            Properties props = new Properties();
            props.setProperty("user", username);
            props.setProperty("password", password == null ? "" : password);
            props.setProperty("connectTimeout", String.valueOf((int) Duration.ofSeconds(5).getSeconds()));

            try (Connection conn = DriverManager.getConnection(jdbcUrl, props)) {
                response.put("success", true);
                response.put("message", "連線成功：" + host + ":" + port + "/" + database);
                response.put("testedAt", Instant.now().toString());
                logService.addLog("SYSTEM_INFO", "SUCCESS", "資料庫連線測試成功 (" + host + ":" + port + "/" + database + ")", "資料庫連線設定");
                return ResponseEntity.ok(response);
            }
        } catch (Exception err) {
            response.put("success", false);
            response.put("message", "連線失敗：" + safeMessage(err));
            response.put("testedAt", Instant.now().toString());
            logService.addLog("SYSTEM_INFO", "ERROR", "資料庫連線測試失敗：" + safeMessage(err), "資料庫連線設定");
            return ResponseEntity.status(502).body(response);
        }
    }

    private static int toInt(Object value, int fallback) {
        if (value == null) return fallback;
        try {
            return Integer.parseInt(String.valueOf(value).trim());
        } catch (NumberFormatException err) {
            return fallback;
        }
    }

    private static String safeMessage(Exception err) {
        return err.getMessage() != null ? err.getMessage() : err.getClass().getSimpleName();
    }
}
