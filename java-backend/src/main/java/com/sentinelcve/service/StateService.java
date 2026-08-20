package com.sentinelcve.service;

import com.sentinelcve.db.PersistenceRepository;
import com.sentinelcve.state.AppState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.sentinelcve.model.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Owns loading/persisting {@link AppState} to/from PostgreSQL. Java port of the
 * loadPersistedState()/persistState() pair in server.ts: persistState() is fire-and-forget
 * (callers never await it) so route handlers keep the exact same synchronous-looking call
 * sites as the original Express code; errors are logged, never thrown to the caller.
 */
@Service
public class StateService {

    private static final Logger log = LoggerFactory.getLogger(StateService.class);

    private final AppState state;
    private final PersistenceRepository repository;
    private final ObjectMapper mapper;

    @Value("${SEED_DEMO_DATA:false}")
    private boolean seedDemoData;

    public StateService(AppState state, PersistenceRepository repository, ObjectMapper mapper) {
        this.state = state;
        this.repository = repository;
        this.mapper = mapper;
    }

    /** Called once at startup, equivalent to `await initDb(); await loadPersistedState();`. */
    public void initAndLoad() {
        repository.initDb();
        boolean loaded = repository.loadPersistedState(state);
        if (!loaded) {
            if (seedDemoData) {
                log.info("PostgreSQL has no persisted state yet; seeding it with the initial demo dataset (SEED_DEMO_DATA=true).");
                loadDemoDataset();
            } else {
                log.info("PostgreSQL has no persisted state yet; starting with an empty dataset (set SEED_DEMO_DATA=true to load demo data).");
            }
            persistNow();
        }
    }

    private void loadDemoDataset() {
        try (InputStream is = getClass().getResourceAsStream("/demo-data.json")) {
            if (is == null) {
                log.warn("demo-data.json not found on classpath; starting with an empty dataset instead.");
                return;
            }
            JsonNode root = mapper.readTree(is);
            synchronized (state.lock) {
                state.products = readList(root, "products", MonitoredProduct.class);
                state.cvesDatabase = readList(root, "cves", CveItem.class);
                state.rules = readList(root, "rules", AlertRule.class);
                state.notifications = readList(root, "notifications", AlertNotification.class);
                state.webhooks = readList(root, "webhooks", WebhookConfig.class);
                state.logs = readList(root, "logs", ScanLog.class);
                state.projects = readList(root, "projects", Project.class);
                state.tickets = readList(root, "tickets", Ticket.class);
                if (root.has("emailConfig")) {
                    state.emailConfig = mapper.treeToValue(root.get("emailConfig"), EmailNotificationConfig.class);
                }
            }
        } catch (IOException e) {
            log.error("Failed to load demo-data.json; starting with an empty dataset.", e);
        }
    }

    private <T> List<T> readList(JsonNode root, String field, Class<T> clazz) {
        List<T> out = new ArrayList<>();
        if (!root.has(field)) return out;
        for (JsonNode node : root.get(field)) {
            try {
                out.add(mapper.treeToValue(node, clazz));
            } catch (IOException e) {
                log.error("Failed to parse demo-data.json entry for {}", field, e);
            }
        }
        return out;
    }

    /** Fire-and-forget persist, matching server.ts's `persistState()` call sites. */
    @Async
    public void persist() {
        persistNow();
    }

    private void persistNow() {
        try {
            AppState snapshot;
            synchronized (state.lock) {
                snapshot = state;
                repository.persistState(snapshot);
            }
        } catch (Exception e) {
            log.error("Failed to persist application state to PostgreSQL:", e);
        }
    }
}
