FROM node:20-alpine AS frontend

WORKDIR /app

COPY . .
RUN npm ci && npm run build

FROM maven:3.9-eclipse-temurin-21 AS backend

WORKDIR /build

COPY java-backend/pom.xml ./pom.xml
COPY java-backend/src ./src
COPY --from=frontend /app/dist ./src/main/resources/static
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=backend /build/target/sentinel-cve-server.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["java","-jar","/app/app.jar"]
