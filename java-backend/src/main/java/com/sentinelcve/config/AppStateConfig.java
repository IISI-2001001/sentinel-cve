package com.sentinelcve.config;

import com.sentinelcve.model.AiConfig;
import com.sentinelcve.model.ScheduleConfig;
import com.sentinelcve.model.TeamsNotificationConfig;
import com.sentinelcve.state.AppState;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;

/** Provides the singleton AppState bean, pre-populated with the same default config values
 * that server.ts assigns to scheduleConfig / teamsConfig / currentAiConfig at module load time. */
@Configuration
public class AppStateConfig {

    @Bean
    public AppState appState() {
        AppState state = new AppState();

        ScheduleConfig schedule = state.scheduleConfig;
        schedule.setEnabled(true);
        schedule.setIntervalMinutes(30);
        schedule.setCronExpression("*/30 * * * *");
        schedule.setScanScope("ALL");
        schedule.setAutoAiAnalysis(true);
        schedule.setAutoNotifyTeams(true);
        schedule.setAutoNotifyEmail(true);
        schedule.setLastRunAt(Instant.now().toString());
        schedule.setNextRunAt(Instant.now().plusSeconds(30 * 60).toString());

        TeamsNotificationConfig teams = state.teamsConfig;
        teams.setWebhookUrl("https://outlook.office.com/webhook/sample-teams-channel");
        teams.setChannelName("DevSecOps 資安緊急通報頻道");
        teams.setEnabled(true);
        teams.setMinCvssScore(7.0);
        teams.setNotifyCisaKevOnly(false);
        teams.setBotDisplayName("SentinelCVE Bot");

        AiConfig ai = state.currentAiConfig;
        ai.setProvider("gemini");
        ai.setModel("gemini-3.6-flash");
        ai.setApiKey("");
        ai.setBaseUrl("");
        ai.setTemperature(0.2);
        ai.setPromptPreset("ciso");
        ai.setCustomSystemPrompt("");

        return state;
    }
}
