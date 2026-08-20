package com.sentinelcve.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors the `{ type, url, retrievedAt }` shape used in CVEItem.dataSources. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DataSourceInfo {
    private String type;
    private String url;
    private String retrievedAt;
}
