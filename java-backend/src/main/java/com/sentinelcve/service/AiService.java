package com.sentinelcve.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinelcve.model.AiConfig;
import com.sentinelcve.state.AppState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Java port of getGeminiClient()/generateAiText() in server.ts. Supports Gemini (via its REST
 * API directly, replacing the @google/genai SDK), OpenAI-compatible endpoints (OpenAI/Ollama/
 * custom), and Anthropic Claude. */
@Service
public class AiService {

    private final AppState state;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    @Value("${GEMINI_API_KEY:}")
    private String envGeminiApiKey;

    public AiService(AppState state, ObjectMapper mapper) {
        this.state = state;
        this.mapper = mapper;
    }

    private HttpResponse<String> post(String url, String body, java.util.Map<String, String> headers, int timeoutMs) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofMillis(timeoutMs))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
        headers.forEach(builder::header);
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    public String generateAiText(String prompt) throws Exception {
        return generateAiText(prompt, state.currentAiConfig, false);
    }

    public String generateAiText(String prompt, AiConfig config, boolean jsonResponse) throws Exception {
        String provider = config.getProvider() != null ? config.getProvider() : "gemini";
        String model = config.getModel() != null ? config.getModel() : "gemini-2.5-flash";

        if ("gemini".equals(provider)) {
            String apiKey = firstNonBlank(config.getApiKey(), state.currentAiConfig.getApiKey(), envGeminiApiKey);
            if (apiKey == null || apiKey.isBlank()) throw new RuntimeException("Gemini API Key 尚未設定。");
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
            var body = mapper.createObjectNode();
            var contents = body.putArray("contents").addObject();
            contents.putArray("parts").addObject().put("text", prompt);
            var genConfig = body.putObject("generationConfig");
            genConfig.put("temperature", config.getTemperature());
            if (jsonResponse) genConfig.put("responseMimeType", "application/json");

            HttpResponse<String> response = post(url, body.toString(), java.util.Map.of("User-Agent", "aistudio-build"), 60000);
            JsonNode json = mapper.readTree(response.body());
            if (response.statusCode() / 100 != 2) {
                String message = json.path("error").path("message").asText("Gemini API 回傳 HTTP " + response.statusCode());
                throw new RuntimeException(message);
            }
            String text = json.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText(null);
            if (text == null) throw new RuntimeException("AI 未回傳內容。");
            return text;
        }

        if ("openai".equals(provider) || "ollama".equals(provider) || "custom".equals(provider)) {
            String defaultBase = "ollama".equals(provider) ? "http://host.docker.internal:11434/v1" : "https://api.openai.com/v1";
            String endpoint = (config.getBaseUrl() != null && !config.getBaseUrl().isBlank() ? config.getBaseUrl() : defaultBase).replaceFirst("/$", "");
            String apiKey = firstNonBlank(config.getApiKey(), state.currentAiConfig.getApiKey(), "");
            if (!"ollama".equals(provider) && (apiKey == null || apiKey.isBlank())) {
                throw new RuntimeException(provider + " API Key 尚未設定。");
            }
            var body = mapper.createObjectNode();
            body.put("model", model);
            var messages = body.putArray("messages").addObject();
            messages.put("role", "user");
            messages.put("content", prompt);
            body.put("temperature", config.getTemperature());
            if (jsonResponse) body.putObject("response_format").put("type", "json_object");

            java.util.Map<String, String> headers = (apiKey != null && !apiKey.isBlank())
                ? java.util.Map.of("Authorization", "Bearer " + apiKey) : java.util.Map.of();
            HttpResponse<String> response = post(endpoint + "/chat/completions", body.toString(), headers, 60000);
            JsonNode json;
            try {
                json = mapper.readTree(response.body());
            } catch (Exception e) {
                json = mapper.createObjectNode();
            }
            if (response.statusCode() / 100 != 2) {
                throw new RuntimeException(json.path("error").path("message").asText("AI API 回傳 HTTP " + response.statusCode()));
            }
            String text = json.path("choices").path(0).path("message").path("content").asText(null);
            if (text == null) throw new RuntimeException("AI 未回傳內容。");
            return text;
        }

        if ("claude".equals(provider)) {
            String apiKey = firstNonBlank(config.getApiKey(), state.currentAiConfig.getApiKey(), "");
            if (apiKey == null || apiKey.isBlank()) throw new RuntimeException("Anthropic API Key 尚未設定。");
            String endpoint = (config.getBaseUrl() != null && !config.getBaseUrl().isBlank() ? config.getBaseUrl() : "https://api.anthropic.com/v1").replaceFirst("/$", "");
            var body = mapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", 4096);
            body.put("temperature", config.getTemperature());
            var messages = body.putArray("messages").addObject();
            messages.put("role", "user");
            messages.put("content", prompt);

            HttpResponse<String> response = post(endpoint + "/messages", body.toString(),
                java.util.Map.of("x-api-key", apiKey, "anthropic-version", "2023-06-01"), 60000);
            JsonNode json;
            try {
                json = mapper.readTree(response.body());
            } catch (Exception e) {
                json = mapper.createObjectNode();
            }
            if (response.statusCode() / 100 != 2) {
                throw new RuntimeException(json.path("error").path("message").asText("Anthropic API 回傳 HTTP " + response.statusCode()));
            }
            String text = null;
            for (JsonNode block : json.path("content")) {
                if ("text".equals(block.path("type").asText())) {
                    text = block.path("text").asText(null);
                    break;
                }
            }
            if (text == null) throw new RuntimeException("Claude 未回傳內容。");
            return text;
        }

        throw new RuntimeException("Provider " + provider + " 尚未實作；目前支援 Gemini、OpenAI、Claude、Ollama 與 OpenAI 相容端點。");
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
