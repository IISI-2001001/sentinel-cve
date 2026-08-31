package com.sentinelcve.config;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Properties;

/**
 * Reads/writes the optional local override file (default {@code config/db.properties}, relative
 * to the process working directory — resolves to {@code /app/config/db.properties} inside the
 * Docker image, which is mounted as a named volume so it survives image rebuilds) that lets an
 * administrator change the PostgreSQL connection from 系統管理 > 資料庫連線 without editing
 * docker-compose.yml or the DATABASE_URL environment variable. When present, its DATABASE_URL
 * takes precedence over the DATABASE_URL env var (see {@link DataSourceConfig}). A backend
 * restart is required for changes to take effect.
 */
public final class DbConfigFileStore {

    private static final String DATABASE_URL_KEY = "DATABASE_URL";
    private static final String UPDATED_AT_KEY = "updatedAt";

    private DbConfigFileStore() {
    }

    public static Path resolvePath() {
        String dir = System.getenv().getOrDefault("DB_CONFIG_DIR", "config");
        return Paths.get(dir, "db.properties");
    }

    public static String readDatabaseUrl() {
        Path path = resolvePath();
        if (!Files.isRegularFile(path)) return null;
        try (InputStream in = Files.newInputStream(path)) {
            Properties props = new Properties();
            props.load(in);
            String value = props.getProperty(DATABASE_URL_KEY);
            return (value != null && !value.isBlank()) ? value : null;
        } catch (IOException err) {
            return null;
        }
    }

    public static String readUpdatedAt() {
        Path path = resolvePath();
        if (!Files.isRegularFile(path)) return null;
        try (InputStream in = Files.newInputStream(path)) {
            Properties props = new Properties();
            props.load(in);
            return props.getProperty(UPDATED_AT_KEY);
        } catch (IOException err) {
            return null;
        }
    }

    public static void write(String databaseUrl) throws IOException {
        Path path = resolvePath();
        Files.createDirectories(path.getParent() != null ? path.getParent() : Paths.get("."));
        Properties props = new Properties();
        props.setProperty(DATABASE_URL_KEY, databaseUrl);
        props.setProperty(UPDATED_AT_KEY, Instant.now().toString());
        try (OutputStream out = Files.newOutputStream(path)) {
            props.store(out, "SentinelCVE database connection override - managed via 系統管理 > 資料庫連線 UI");
        }
    }

    public static boolean exists() {
        return Files.isRegularFile(resolvePath());
    }
}
