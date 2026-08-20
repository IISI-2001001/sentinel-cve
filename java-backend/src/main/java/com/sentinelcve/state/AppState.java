package com.sentinelcve.state;

import com.sentinelcve.model.*;

import java.util.ArrayList;
import java.util.List;

/**
 * In-memory application state, mirroring the module-level `let products = [...]`, `let
 * cvesDatabase = [...]`, etc. arrays in the original server.ts. All collections are guarded by
 * a single lock because, unlike Node's single-threaded event loop, Spring's embedded Tomcat
 * serves requests on multiple worker threads concurrently.
 *
 * Callers should synchronize on {@link #lock} whenever they read-then-mutate a collection (the
 * same pattern the original code relied on implicitly via JS's single-threaded execution).
 */
public class AppState {

    public final Object lock = new Object();

    public List<MonitoredProduct> products = new ArrayList<>();
    public List<CveItem> cvesDatabase = new ArrayList<>();
    public List<AlertRule> rules = new ArrayList<>();
    public List<AlertNotification> notifications = new ArrayList<>();
    public List<WebhookConfig> webhooks = new ArrayList<>();
    public List<ScanLog> logs = new ArrayList<>();
    public List<Project> projects = new ArrayList<>();
    public List<Ticket> tickets = new ArrayList<>();

    public EmailNotificationConfig emailConfig = new EmailNotificationConfig();
    public ScheduleConfig scheduleConfig = new ScheduleConfig();
    public TeamsNotificationConfig teamsConfig = new TeamsNotificationConfig();
    public AiConfig currentAiConfig = new AiConfig();
}
