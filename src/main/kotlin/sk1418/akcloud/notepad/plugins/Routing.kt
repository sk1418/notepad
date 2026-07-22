package sk1418.akcloud.notepad.plugins

import io.ktor.server.application.*
import io.ktor.server.http.content.*
import io.ktor.server.routing.*
import sk1418.akcloud.notepad.NoteService
import sk1418.akcloud.notepad.routes.noteRoutes

fun Application.configureRouting(service: NoteService) {
    routing {
        noteRoutes(service)
        // Serve built frontend from resources/static; SPA fallback to index.html
        singlePageApplication {
            useResources = true
            filesPath = "static"
            defaultPage = "index.html"
        }
    }
}