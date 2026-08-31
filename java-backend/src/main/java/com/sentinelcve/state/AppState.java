package com.sentinelcve.state;

import com.sentinelcve.model.*;

import java.util.ArrayList;
import java.util.List;

/**
 * In-memory application state, mirroring the module-level arrays in the original server.ts.
 * All collections are guarded by a single lock because Spring serves requests concurrently.
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
    public NvdApiConfig nvdApiConfig = new NvdApiConfig();
}
