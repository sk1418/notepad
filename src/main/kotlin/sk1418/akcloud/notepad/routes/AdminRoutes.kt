package sk1418.akcloud.notepad.routes

import io.ktor.http.HttpStatusCode
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.server.sessions.clear
import io.ktor.server.sessions.get
import io.ktor.server.sessions.sessions
import io.ktor.server.sessions.set
import sk1418.akcloud.notepad.AdminDisabledException
import sk1418.akcloud.notepad.AdminService
import sk1418.akcloud.notepad.AdminUnauthorizedException
import sk1418.akcloud.notepad.model.AdminLoginRequest
import sk1418.akcloud.notepad.model.AdminSetPasswordRequest
import sk1418.akcloud.notepad.model.DeleteNotesRequest
import sk1418.akcloud.notepad.model.NoteContentResponse
import sk1418.akcloud.notepad.plugins.AUTH_LIMIT
import sk1418.akcloud.notepad.plugins.AdminSession

fun Route.adminRoutes(admin: AdminService) {
    route("/admin") {
        get("/status") {
            call.respond(mapOf(
                "enabled" to admin.enabled,
                "loggedIn" to (call.sessions.get<AdminSession>() != null),
            ))
        }

        rateLimit(AUTH_LIMIT) {
            post("/login") {
                if (!admin.enabled) throw AdminDisabledException()
                val req = call.receive<AdminLoginRequest>()
                admin.verifyLogin(req.password)
                call.sessions.set(AdminSession(System.currentTimeMillis()))
                call.respond(mapOf("ok" to true))
            }
        }

        post("/logout") {
            call.sessions.clear<AdminSession>()
            call.respond(HttpStatusCode.OK, mapOf("ok" to true))
        }

        get("/notes") {
            requireAdmin()
            call.respond(admin.listSummaries())
        }

        post("/notes/delete") {
            requireAdmin()
            val req = call.receive<DeleteNotesRequest>()
            val removed = admin.deleteNotes(req.keys)
            call.respond(mapOf("deleted" to removed))
        }

        get("/notes/{key}/content") {
            requireAdmin()
            val key = call.parameters["key"]!!
            call.respond(NoteContentResponse(key, admin.getContent(key)))
        }

        post("/notes/{key}/password") {
            requireAdmin()
            val key = call.parameters["key"]!!
            val req = call.receive<AdminSetPasswordRequest>()
            admin.setNotePassword(key, req.password)
            call.respond(mapOf("ok" to true))
        }
    }
}

private const val ADMIN_SESSION_MAX_AGE_MS = 8L * 60 * 60 * 1000 // 8h

private suspend fun RoutingContext.requireAdmin(): AdminSession {
    val s = call.sessions.get<AdminSession>() ?: throw AdminUnauthorizedException()
    val age = System.currentTimeMillis() - s.since
    if (age < 0 || age > ADMIN_SESSION_MAX_AGE_MS) {
        call.sessions.clear<AdminSession>()
        throw AdminUnauthorizedException()
    }
    return s
}