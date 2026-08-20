package com.sentinelcve.service;

import com.sentinelcve.model.EmailNotificationConfig;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.util.Properties;

/** Java port of createMailTransport()/nodemailer usage in server.ts. Builds a fresh
 * JavaMailSenderImpl per call because SMTP settings (emailConfig) can change at runtime via
 * PUT /api/email/config, unlike Spring Boot's statically-configured spring.mail.* properties. */
@Service
public class MailService {

    public void sendMail(EmailNotificationConfig config, String to, String subject, String text) throws Exception {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(config.getSmtpServer());
        sender.setPort(config.getSmtpPort());
        boolean secure = config.getSmtpPort() == 465;

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", config.isEnableAuth() && config.getUsername() != null);
        props.put("mail.smtp.starttls.enable", !secure);
        props.put("mail.smtp.ssl.enable", secure);
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "15000");
        props.put("mail.smtp.writetimeout", "15000");

        if (config.isEnableAuth() && config.getUsername() != null) {
            sender.setUsername(config.getUsername());
            sender.setPassword(config.getPassword() != null ? config.getPassword() : "");
        }

        MimeMessage message = sender.createMimeMessage();
        var helper = new org.springframework.mail.javamail.MimeMessageHelper(message, false, "UTF-8");
        String fromName = config.getSenderName() != null && !config.getSenderName().isBlank() ? config.getSenderName() : "SentinelCVE";
        helper.setFrom(config.getSenderEmail(), fromName);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(text, false);

        sender.send(message);
    }
}
