package sk1418.akcloud.notepad.plugins

import io.ktor.server.application.*
import io.ktor.server.sessions.*
import io.ktor.util.*
import kotlinx.serialization.Serializable

const val NOTE_KEY = "note_key"
const val ADMIN_KEY = "admin_session"

// Historical default that was shipped in application.yaml. Never accept it at runtime.
private const val LEAKED_SIGN_KEY = "6819b57a326945c1968f45236589"
private const val MIN_SIGN_KEY_HEX_LEN = 32 // 16 bytes

fun Application.configureSession() {
    val rawKey = environment.config.propertyOrNull("session.signKey")?.getString()?.trim().orEmpty()
    require(rawKey.isNotBlank()) {
        "SESSION_SIGN_KEY is not set. Refusing to start. Generate a random hex string (>= 32 hex chars) and set it via env."
    }
    require(rawKey != LEAKED_SIGN_KEY) {
        "SESSION_SIGN_KEY matches the known-leaked default from the repo. Rotate it to a random hex value."
    }
    require(rawKey.length >= MIN_SIGN_KEY_HEX_LEN) {
        "SESSION_SIGN_KEY too short (${rawKey.length} chars); need at least $MIN_SIGN_KEY_HEX_LEN hex chars."
    }
    val secretSignKey = hex(rawKey)
    val isProd = environment.config.propertyOrNull("ktor.deployment.environment")?.getString() == "prod"
    install(Sessions) {
        cookie<UserSession>(NOTE_KEY) {
            cookie.path = "/"
            cookie.httpOnly = true
            cookie.extensions["SameSite"] = "Strict"
            cookie.secure = isProd
            transform(SessionTransportTransformerMessageAuthentication(secretSignKey))
        }
        cookie<AdminSession>(ADMIN_KEY) {
            cookie.path = "/"
            cookie.httpOnly = true
            cookie.extensions["SameSite"] = "Strict"
            cookie.secure = isProd
            transform(SessionTransportTransformerMessageAuthentication(secretSignKey))
        }
    }
}

@Serializable
data class UserSession(val noteKey: String)

@Serializable
data class AdminSession(val since: Long)