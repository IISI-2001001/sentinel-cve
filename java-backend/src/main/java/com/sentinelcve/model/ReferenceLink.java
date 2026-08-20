package com.sentinelcve.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Mirrors the `{ name, url }` reference shape used in CVEItem.references. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReferenceLink {
    private String name;
    private String url;
}
