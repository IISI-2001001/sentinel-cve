package com.sentinelcve.db;

import java.net.URI;
import java.net.URISyntaxException;

/**
 * Shared helpers for parsing/building the {@code DATABASE_URL} connection string
 * (postgres://user:password@host:port/database) used both by {@code DataSourceConfig} at
 * startup and by {@code DbConfigController} when saving/testing connection settings from the
 * 系統管理 > 資料庫連線 UI.
 */
public final class DatabaseUrlUtil {

    private DatabaseUrlUtil() {
    }

    public record Parsed(String host, int port, String database, String username, String password) {
    }

    public static Parsed parse(String databaseUrl) throws URISyntaxException {
        URI uri = new URI(databaseUrl.replaceFirst("^postgres(ql)?://", "postgresql://"));
        String userInfo = uri.getUserInfo();
        String user = userInfo != null ? userInfo.split(":", 2)[0] : null;
        String password = userInfo != null && userInfo.contains(":") ? userInfo.split(":", 2)[1] : null;
        int port = uri.getPort() > 0 ? uri.getPort() : 5432;
        String db = uri.getPath() != null ? uri.getPath().replaceFirst("^/", "") : null;
        return new Parsed(uri.getHost(), port, db, user, password);
    }

    public static String build(String host, int port, String database, String username, String password) {
        return "postgres://" + urlEncode(username) + ":" + urlEncode(password) + "@" + host + ":" + port + "/" + database;
    }

    public static String toJdbcUrl(String host, int port, String database) {
        return "jdbc:postgresql://" + host + ":" + port + "/" + database;
    }

    private static String urlEncode(String value) {
        if (value == null) return "";
        return value.replace("%", "%25").replace(":", "%3A").replace("@", "%40").replace("/", "%2F");
    }
}
