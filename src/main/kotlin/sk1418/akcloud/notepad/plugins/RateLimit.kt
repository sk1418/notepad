package sk1418.akcloud.notepad.plugins

import io.ktor.server.application.*
import io.ktor.server.plugins.ratelimit.*
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

val AUTH_LIMIT = RateLimitName("auth")
val WRITE_LIMIT = RateLimitName("write")

fun Application.configureRateLimit() {
    install(RateLimit) {
        register(AUTH_LIMIT) {
            rateLimiter(limit = 1, refillPeriod = 3.seconds)
        }
        register(WRITE_LIMIT) {
            rateLimiter(limit = 120, refillPeriod = 1.minutes)
        }
    }
}
