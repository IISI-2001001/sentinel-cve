package com.sentinelcve.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaFallbackController {

    @GetMapping(value = {"/", "/{path:^(?!api$)[^\\.]*}", "/{path:^(?!api$)[^\\.]*}/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
