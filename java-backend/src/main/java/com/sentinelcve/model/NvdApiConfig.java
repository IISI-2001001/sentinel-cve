package com.sentinelcve.model;

import lombok.Data;
import lombok.NoArgsConstructor;

/** Persisted NVD (National Vulnerability Database) REST API key configuration, managed from
 * the 系統管理 > NVD API Key 頁面. When apiKey is blank, all NVD calls fall back to anonymous
 * requests (subject to NVD's stricter public rate limit). */
@Data
@NoArgsConstructor
public class NvdApiConfig {
    private String apiKey;
    private String updatedAt;
}
