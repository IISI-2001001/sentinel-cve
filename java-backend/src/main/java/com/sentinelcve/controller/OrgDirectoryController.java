package com.sentinelcve.controller;

import com.sentinelcve.db.PersistenceRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Admin management endpoints for the "組織清單管理" page under 系統管理與設定中心.
 * Maintains the {@code departments} and {@code project_managers} lookup tables so that the
 * "新增專案" form in 專案管理 can offer them as dropdown selections instead of freeform text.
 */
@RestController
@RequestMapping("/api/org-directory")
public class OrgDirectoryController {

    private final PersistenceRepository persistenceRepository;

    public OrgDirectoryController(PersistenceRepository persistenceRepository) {
        this.persistenceRepository = persistenceRepository;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        return ResponseEntity.ok(Map.of(
            "departments", persistenceRepository.listDepartments(),
            "projectManagers", persistenceRepository.listProjectManagers()
        ));
    }

    @PostMapping("/departments")
    public ResponseEntity<?> addDepartment(@RequestBody(required = false) Map<String, Object> body) {
        String name = asString(safeBody(body).get("name"));
        if (!hasText(name)) {
            return ResponseEntity.badRequest().body(error("name is required."));
        }
        Map<String, Object> entry = persistenceRepository.addDepartment(name.trim());
        return ResponseEntity.ok(entry);
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<?> deleteDepartment(@PathVariable String id) {
        persistenceRepository.deleteDepartment(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/project-managers")
    public ResponseEntity<?> addProjectManager(@RequestBody(required = false) Map<String, Object> body) {
        String name = asString(safeBody(body).get("name"));
        if (!hasText(name)) {
            return ResponseEntity.badRequest().body(error("name is required."));
        }
        Map<String, Object> entry = persistenceRepository.addProjectManager(name.trim());
        return ResponseEntity.ok(entry);
    }

    @DeleteMapping("/project-managers/{id}")
    public ResponseEntity<?> deleteProjectManager(@PathVariable String id) {
        persistenceRepository.deleteProjectManager(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    private static Map<String, Object> safeBody(Map<String, Object> body) {
        return body != null ? body : Map.of();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private LinkedHashMap<String, Object> error(String message) {
        LinkedHashMap<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        return body;
    }
}
