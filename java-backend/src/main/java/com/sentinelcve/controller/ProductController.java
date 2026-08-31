package com.sentinelcve.controller;

import com.sentinelcve.state.AppState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;

/** Read-only monitored product listing used by the dashboard and project views. */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final AppState state;

    public ProductController(AppState state) {
        this.state = state;
    }

    @GetMapping
    public ResponseEntity<?> getProducts() {
        synchronized (state.lock) {
            return ResponseEntity.ok(new ArrayList<>(state.products));
        }
    }
}
