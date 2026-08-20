package com.sentinelcve.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URISyntaxException;

/**
 * Builds the PostgreSQL DataSource. Mirrors src/server/db.ts: prefers a single DATABASE_URL
 * (postgres://user:pass@host:port/db, as produced by docker-compose), falling back to
 * discrete PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE env vars, then finally to localhost
 * defaults for local development.
 */
@Configuration
public class DataSourceConfig {

    @Value("${DATABASE_URL:}")
    private String databaseUrl;

    @Value("${PGHOST:localhost}")
    private String pgHost;

    @Value("${PGPORT:5432}")
    private String pgPort;

    @Value("${PGUSER:postgres}")
    private String pgUser;

    @Value("${PGPASSWORD:postgres}")
    private String pgPassword;

    @Value("${PGDATABASE:sentinel_cve}")
    private String pgDatabase;

    @Value("${PGSSLMODE:}")
    private String sslMode;

    @Bean
    public DataSource dataSource() throws URISyntaxException {
        String jdbcUrl;
        String user;
        String password;

        if (databaseUrl != null && !databaseUrl.isBlank()) {
            // postgres://user:password@host:port/database
            URI uri = new URI(databaseUrl.replaceFirst("^postgres(ql)?://", "postgresql://"));
            String userInfo = uri.getUserInfo();
            user = userInfo != null ? userInfo.split(":", 2)[0] : pgUser;
            password = userInfo != null && userInfo.contains(":") ? userInfo.split(":", 2)[1] : pgPassword;
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String db = uri.getPath() != null ? uri.getPath().replaceFirst("^/", "") : pgDatabase;
            jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port + "/" + db;
        } else {
            jdbcUrl = "jdbc:postgresql://" + pgHost + ":" + pgPort + "/" + pgDatabase;
            user = pgUser;
            password = pgPassword;
        }

        if ("require".equalsIgnoreCase(sslMode)) {
            jdbcUrl += jdbcUrl.contains("?") ? "&sslmode=require" : "?sslmode=require";
        }

        HikariDataSource dataSource = DataSourceBuilder.create()
            .type(HikariDataSource.class)
            .url(jdbcUrl)
            .username(user)
            .password(password)
            .driverClassName("org.postgresql.Driver")
            .build();
        dataSource.setPoolName("sentinel-cve-pool");
        return dataSource;
    }
}
