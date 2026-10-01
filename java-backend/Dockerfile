FROM maven:3.9-eclipse-temurin-21 AS backend

WORKDIR /build

COPY java-backend/pom.xml ./pom.xml
COPY java-backend/src ./src
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=backend /build/target/sentinel-cve-server.jar /app/app.jar

EXPOSE 5173

ENTRYPOINT ["java","-jar","/app/app.jar"]
