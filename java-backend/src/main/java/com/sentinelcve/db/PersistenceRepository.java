package com.sentinelcve.db;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.*;
import com.sentinelcve.state.AppState;
import org.postgresql.util.PGobject;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.function.Function;

/**
 * PostgreSQL persistence layer - a direct Java port of src/server/db.ts. Each in-memory
 * collection in {@link AppState} is mirrored to its own table; the full object is stored as
 * JSONB (`data`) so the Java model classes above don't need a hand-mapped relational schema.
 * A handful of columns are extracted purely for ad-hoc SQL inspection/queries, and a
 * `position` column preserves the exact array order across save/reload cycles (some
 * collections rely on insertion order, e.g. logs/notifications are always inserted at the
 * front so the newest entry is first).
 */
@Repository
public class PersistenceRepository {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper mapper;

    public PersistenceRepository(JdbcTemplate jdbc, TransactionTemplate transactionTemplate, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.transactionTemplate = transactionTemplate;
        this.mapper = mapper;
    }

    public void initDb() {
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS products (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              name TEXT,
              criticality TEXT,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS cves (
              position INT NOT NULL,
              id TEXT NOT NULL,
              product_name TEXT NOT NULL,
              severity TEXT,
              cvss_score NUMERIC,
              cisa_kev BOOLEAN,
              data JSONB NOT NULL,
              PRIMARY KEY (id, product_name)
            );
            CREATE TABLE IF NOT EXISTS rules (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notifications (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              cve_id TEXT,
              status TEXT,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS webhooks (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS logs (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              type TEXT,
              level TEXT,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS projects (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              code TEXT,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tickets (
              position INT NOT NULL,
              id TEXT PRIMARY KEY,
              status TEXT,
              data JSONB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS app_config (
              key TEXT PRIMARY KEY,
              value JSONB NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves (severity);
            CREATE INDEX IF NOT EXISTS idx_cves_cisa_kev ON cves (cisa_kev);
            CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
            """);
    }

    private PGobject json(Object value) {
        try {
            PGobject obj = new PGobject();
            obj.setType("jsonb");
            obj.setValue(mapper.writeValueAsString(value));
            return obj;
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize value to JSONB", e);
        }
    }

    private <T> void replaceCollection(String table, List<T> items, String[] extraColumns, Function<T, Object[]> extraValues) {
        jdbc.update("DELETE FROM " + table);
        String columns = "position, " + String.join(", ", extraColumns) + ", data";
        String placeholders = "?, " + String.join(", ", java.util.Collections.nCopies(extraColumns.length, "?")) + ", ?";
        String sql = "INSERT INTO " + table + " (" + columns + ") VALUES (" + placeholders + ")";
        for (int position = 0; position < items.size(); position++) {
            T item = items.get(position);
            Object[] extra = extraValues.apply(item);
            final int pos = position;
            jdbc.update(sql, (PreparedStatement ps) -> {
                int idx = 1;
                ps.setInt(idx++, pos);
                for (Object value : extra) {
                    ps.setObject(idx++, value);
                }
                ps.setObject(idx, json(item));
            });
        }
    }

    public void persistState(AppState state) {
        transactionTemplate.executeWithoutResult(status -> {
            replaceCollection("products", state.products, new String[]{"name", "criticality"},
                p -> new Object[]{p.getName(), p.getCriticality()});
            replaceCollection("cves", state.cvesDatabase, new String[]{"product_name", "severity", "cvss_score", "cisa_kev"},
                c -> new Object[]{
                    c.getProductName(),
                    c.getCvss() != null ? c.getCvss().getSeverity() : null,
                    c.getCvss() != null ? c.getCvss().getBaseScore() : null,
                    c.isCisaKev(),
                });
            replaceCollection("rules", state.rules, new String[]{}, r -> new Object[]{});
            replaceCollection("notifications", state.notifications, new String[]{"cve_id", "status"},
                n -> new Object[]{n.getCveId(), n.getStatus()});
            replaceCollection("webhooks", state.webhooks, new String[]{}, w -> new Object[]{});
            replaceCollection("logs", state.logs, new String[]{"type", "level"},
                l -> new Object[]{l.getType(), l.getLevel()});
            replaceCollection("projects", state.projects, new String[]{"code"}, p -> new Object[]{p.getCode()});
            replaceCollection("tickets", state.tickets, new String[]{"status"}, t -> new Object[]{t.getStatus()});

            jdbc.update("DELETE FROM app_config");
            jdbc.update("INSERT INTO app_config (key, value) VALUES (?, ?)", "emailConfig", json(state.emailConfig));
            jdbc.update("INSERT INTO app_config (key, value) VALUES (?, ?)", "scheduleConfig", json(state.scheduleConfig));
            jdbc.update("INSERT INTO app_config (key, value) VALUES (?, ?)", "teamsConfig", json(state.teamsConfig));
            jdbc.update("INSERT INTO app_config (key, value) VALUES (?, ?)", "currentAiConfig", json(state.currentAiConfig));
        });
    }

    private <T> RowMapper<T> dataMapper(Class<T> clazz) {
        return (rs, rowNum) -> {
            try {
                return mapper.readValue(rs.getString("data"), clazz);
            } catch (Exception e) {
                throw new SQLException("Failed to deserialize row from " + clazz.getSimpleName(), e);
            }
        };
    }

    private <T> List<T> loadCollection(String table, Class<T> clazz) {
        return jdbc.query("SELECT data FROM " + table + " ORDER BY position ASC", dataMapper(clazz));
    }

    /** Populates the given AppState from PostgreSQL. Returns true if any persisted data was found. */
    public boolean loadPersistedState(AppState state) {
        List<MonitoredProduct> products = loadCollection("products", MonitoredProduct.class);
        List<CveItem> cves = loadCollection("cves", CveItem.class);
        List<AlertRule> rules = loadCollection("rules", AlertRule.class);
        List<AlertNotification> notifications = loadCollection("notifications", AlertNotification.class);
        List<WebhookConfig> webhooks = loadCollection("webhooks", WebhookConfig.class);
        List<ScanLog> logs = loadCollection("logs", ScanLog.class);
        List<Project> projects = loadCollection("projects", Project.class);
        List<Ticket> tickets = loadCollection("tickets", Ticket.class);

        EmailNotificationConfig emailConfig = loadConfig("emailConfig", EmailNotificationConfig.class);
        ScheduleConfig scheduleConfig = loadConfig("scheduleConfig", ScheduleConfig.class);
        TeamsNotificationConfig teamsConfig = loadConfig("teamsConfig", TeamsNotificationConfig.class);
        AiConfig aiConfig = loadConfig("currentAiConfig", AiConfig.class);

        boolean hasAnyPersistedData = !products.isEmpty() || !cves.isEmpty() || !rules.isEmpty()
            || !notifications.isEmpty() || !webhooks.isEmpty() || !logs.isEmpty() || !projects.isEmpty()
            || !tickets.isEmpty() || emailConfig != null || scheduleConfig != null || teamsConfig != null || aiConfig != null;

        if (!hasAnyPersistedData) {
            return false;
        }

        state.products = products;
        state.cvesDatabase = cves;
        state.rules = rules;
        state.notifications = notifications;
        state.webhooks = webhooks;
        state.logs = logs;
        state.projects = projects;
        state.tickets = tickets;
        if (emailConfig != null) state.emailConfig = emailConfig;
        if (scheduleConfig != null) state.scheduleConfig = scheduleConfig;
        if (teamsConfig != null) state.teamsConfig = teamsConfig;
        if (aiConfig != null) state.currentAiConfig = aiConfig;
        return true;
    }

    private <T> T loadConfig(String key, Class<T> clazz) {
        List<T> rows = jdbc.query("SELECT value FROM app_config WHERE key = ?", (rs, rowNum) -> {
            try {
                return mapper.readValue(rs.getString("value"), clazz);
            } catch (Exception e) {
                throw new SQLException("Failed to deserialize app_config." + key, e);
            }
        }, key);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
