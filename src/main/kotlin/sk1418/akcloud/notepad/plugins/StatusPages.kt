package sk1418.akcloud.notepad.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import sk1418.akcloud.notepad.AdminDisabledException
import sk1418.akcloud.notepad.AdminUnauthorizedException
import sk1418.akcloud.notepad.InvalidPasswordException
import sk1418.akcloud.notepad.NoteKeyExistsException
import sk1418.akcloud.notepad.NoteNotFoundException
import sk1418.akcloud.notepad.NotepadException

fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<NoteNotFoundException> { call, e ->
            call.respond(HttpStatusCode.NotFound, mapOf("error" to e.msg))
        }
        exception<InvalidPasswordException> { call, e ->
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to e.msg))
        }
        exception<AdminUnauthorizedException> { call, e ->
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to e.msg))
        }
        exception<AdminDisabledException> { call, e ->
            call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to e.msg))
        }
        exception<NoteKeyExistsException> { call, e ->
            call.respond(HttpStatusCode.Conflict, mapOf("error" to e.msg))
        }
        exception<NotepadException> { call, e ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.msg))
        }
        exception<Throwable> { call, e ->
            call.application.log.error("Unhandled", e)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to "internal"))
        }
    }
}
