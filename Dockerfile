# syntax=docker/dockerfile:1.7

########################  Stage 1: Build frontend  ########################
# Pinned to the builder's native arch — JS bundling is arch-agnostic and this
# avoids qemu-emulating amd64 npm on arm64 hosts (which hangs for minutes/hours).
FROM --platform=$BUILDPLATFORM node:22-alpine AS fe-build
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

########################  Stage 2: Build backend  #########################
# Same reason — JVM bytecode is arch-agnostic. Only the runtime stage varies.
FROM --platform=$BUILDPLATFORM eclipse-temurin:21-jdk AS be-build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties* ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew --version >/dev/null
COPY src ./src
# Inject built FE assets so Ktor can serve them from classpath resources/static
COPY --from=fe-build /fe/dist ./src/main/resources/static
RUN ./gradlew --no-daemon shadowJar -x test

########################  Stage 3: Runtime  ###############################
FROM eclipse-temurin:21-jre
ARG APP_VERSION=dev
LABEL org.opencontainers.image.version=$APP_VERSION
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -r -u 1001 -g root notepad && mkdir -p /data && chown -R notepad /data
COPY --from=be-build /src/build/libs/*-all.jar /app/app.jar

ENV DB_URL=jdbc:sqlite:/data/note.db \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"

EXPOSE 8080
USER notepad
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/ >/dev/null || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
