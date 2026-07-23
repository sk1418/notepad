package sk1418.akcloud.notepad.plugins

import io.ktor.http.ContentType
import io.ktor.server.application.*
import io.ktor.server.http.content.*
import io.ktor.server.response.respondBytes
import io.ktor.server.routing.*
import sk1418.akcloud.notepad.AdminService
import sk1418.akcloud.notepad.NoteService
import sk1418.akcloud.notepad.routes.adminRoutes
import sk1418.akcloud.notepad.routes.noteRoutes

fun Application.configureRouting(service: NoteService, admin: AdminService) {
    routing {
        noteRoutes(service)
        adminRoutes(admin)

        // Serve admin.html at /admin (pretty URL)
        get("/admin") {
            val bytes = call.application.javaClass.classLoader
                .getResourceAsStream("static/admin.html")?.readBytes()
            if (bytes != null) call.respondBytes(bytes, ContentType.Text.Html)
            else call.respondBytes(ByteArray(0), ContentType.Text.Html)
        }

        // Serve built frontend from resources/static; SPA fallback to index.html
        singlePageApplication {
            useResources = true
            filesPath = "static"
            defaultPage = "index.html"
            ignoreFiles { it.endsWith("admin.html") }
        }
    }
}