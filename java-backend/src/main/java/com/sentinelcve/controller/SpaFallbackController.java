package com.sentinelcve.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaFallbackController {

    // Excludes "/api/**" (REST endpoints) and "/assets/**" (Vite build output, e.g. hashed .js/.css
    // files) so they are handled by their own controllers / Spring Boot's static resource handler
    // instead of being swallowed by this catch-all and served index.html with the wrong content type.
    @GetMapping(value = {"/", "/{path:^(?!api$|assets$)[^\\.]*}", "/{path:^(?!api$|assets$)[^\\.]*}/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
