package sk1418.akcloud.notepad.plugins

import io.ktor.server.application.*
import io.ktor.server.sessions.*
import io.ktor.util.*
import kotlinx.serialization.Serializable

const val NOTE_KEY = "note_key"

fun Application.configureSession() {
    val secretSignKey = hex(environment.config.property("session.signKey").getString())
    val isProd = environment.config.propertyOrNull("ktor.deployment.environment")?.getString() == "prod"
    install(Sessions) {
        cookie<UserSession>(NOTE_KEY) {
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