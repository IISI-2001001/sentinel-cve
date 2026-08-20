package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Mirrors EmailNotificationConfig in src/types.ts. */
@Data
@NoArgsConstructor
public class EmailNotificationConfig {
    private String smtpServer;
    private int smtpPort;
    private String senderName;
    private String senderEmail;
    private boolean enableAuth;
    private String username;
    private String password;
    private List<String> defaultRecipients;
}
