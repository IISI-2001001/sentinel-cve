package com.sentinelcve;

import com.sentinelcve.service.StateService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class SentinelCveApplication {

    public static void main(String[] args) {
        SpringApplication.run(SentinelCveApplication.class, args);
    }

    /** Equivalent to `await initDb(); await loadPersistedState();` at the top of startServer()
     * in server.ts: runs once at boot, before the embedded web server starts accepting traffic. */
    @Bean
    public CommandLineRunner initState(StateService stateService) {
        return args -> stateService.initAndLoad();
    }
}
