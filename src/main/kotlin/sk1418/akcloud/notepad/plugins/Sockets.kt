package sk1418.akcloud.notepad.plugins

import io.ktor.server.application.*
import io.ktor.server.websocket.*
import kotlin.time.Duration.Companion.seconds

const val MAX_CONTENT_BYTES = 20L * 1024 * 1024  // 20 MB

fun Application.configureSockets() {
    install(WebSockets) {
        pingPeriod = 15.seconds
        timeout = 30.seconds
        maxFrameSize = MAX_CONTENT_BYTES
        masking = false
    }
}