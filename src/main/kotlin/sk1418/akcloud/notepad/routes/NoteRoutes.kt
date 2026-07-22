package sk1418.akcloud.notepad.routes

import io.ktor.http.HttpStatusCode
import io.ktor.http.HttpStatusCode.Companion.OK
import io.ktor.server.plugins.ratelimit.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.sessions.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import sk1418.akcloud.notepad.NoteService
import sk1418.akcloud.notepad.NotepadException
import sk1418.akcloud.notepad.model.SetKeyRequest
import sk1418.akcloud.notepad.model.SetPasswordRequest
import sk1418.akcloud.notepad.model.UnlockRequest
import sk1418.akcloud.notepad.plugins.AUTH_LIMIT
import sk1418.akcloud.notepad.plugins.MAX_CONTENT_BYTES
import sk1418.akcloud.notepad.plugins.UserSession
import sk1418.akcloud.notepad.plugins.WRITE_LIMIT

fun Route.noteRoutes(service: NoteService) {
    post("/{noteKey?}") {
        val note = service.loadNote(call.parameters["noteKey"])
        call.sessions.set(UserSession(note.noteKey))
        call.respond(note)
    }

    rateLimit(AUTH_LIMIT) {
        post("/{noteKey}/unlock") {
            val key = call.parameters["noteKey"]!!
            val req = call.receive<UnlockRequest>()
            val note = service.unlockNote(key, req.password)
            call.sessions.set(UserSession(note.noteKey))
            call.respond(note)
        }
    }

    rateLimit(WRITE_LIMIT) {
        put("/set-password") {
            val key = requireSessionKey() ?: return@put
            service.setPassword(key, call.receive<SetPasswordRequest>())
            call.respond(OK, mapOf("set-password" to "ok"))
        }

        put("/set-noteKey") {
            val key = requireSessionKey() ?: return@put
            val req = call.receive<SetKeyRequest>()
            service.updateNoteKey(key, req)
            call.sessions.set(UserSession(req.key))
            call.respond(OK, mapOf("set-noteKey" to "ok"))
        }

        post("/generate-share") {
            val key = requireSessionKey() ?: return@post
            call.respond(mapOf("readOnlyUrl" to service.generateShareUrl(key)))
        }
    }

    post("/share/{roUrl}") {
        val url = call.parameters["roUrl"]!!
        call.respond(service.loadByShareUrl(url))
    }

    webSocket("/ws/{noteKey}") {
        val key = call.parameters["noteKey"]
            ?: return@webSocket close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "missing key"))
        val session = call.sessions.get<UserSession>()
        if (session?.noteKey != key) {
            return@webSocket close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "unauthorized"))
        }
        for (frame in incoming) {
            if (frame !is Frame.Text) continue
            if (frame.buffer.remaining() > MAX_CONTENT_BYTES) {
                outgoing.send(Frame.Text("err:content too large"))
                continue
            }
            try {
                service.updateContent(key, frame.readText())
                outgoing.send(Frame.Text("ok"))
            } catch (e: NotepadException) {
                outgoing.send(Frame.Text("err:${e.msg}"))
            }
        }
    }
}

private suspend fun RoutingContext.requireSessionKey(): String? {
    val key = call.sessions.get<UserSession>()?.noteKey
    if (key == null) call.respond(HttpStatusCode.Unauthorized)
    return key
}