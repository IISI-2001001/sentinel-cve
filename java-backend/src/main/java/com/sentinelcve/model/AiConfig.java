package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors AiConfig in src/types.ts. AiProvider = gemini | openai | claude | ollama | custom | aws-bedrock. */
@Data
@NoArgsConstructor
public class AiConfig {
    private String provider;
    private String model;
    private String apiKey;
    private String baseUrl;
    private String awsRegion;
    private String awsAccessKeyId;
    private String awsSecretAccessKey;
    private String awsSessionToken;
    private double temperature;
    private String promptPreset; // ciso | redteam | compliance | custom
    private String customSystemPrompt;

    public AiConfig copy() {
        AiConfig c = new AiConfig();
        c.provider = provider;
        c.model = model;
        c.apiKey = apiKey;
        c.baseUrl = baseUrl;
        c.awsRegion = awsRegion;
        c.awsAccessKeyId = awsAccessKeyId;
        c.awsSecretAccessKey = awsSecretAccessKey;
        c.awsSessionToken = awsSessionToken;
        c.temperature = temperature;
        c.promptPreset = promptPreset;
        c.customSystemPrompt = customSystemPrompt;
        return c;
    }
}
