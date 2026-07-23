package sk1418.akcloud.notepad

import io.ktor.server.application.*
import sk1418.akcloud.notepad.data.NoteRepo
import sk1418.akcloud.notepad.plugins.configureDatabase
import sk1418.akcloud.notepad.plugins.configureHTTP
import sk1418.akcloud.notepad.plugins.configureRateLimit
import sk1418.akcloud.notepad.plugins.configureRouting
import sk1418.akcloud.notepad.plugins.configureSerialization
import sk1418.akcloud.notepad.plugins.configureSession
import sk1418.akcloud.notepad.plugins.configureSockets
import sk1418.akcloud.notepad.plugins.configureStatusPages

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    configureSerialization()
    configureStatusPages()
    configureRateLimit()
    configureDatabase()
    configureHTTP()
    configureSession()
    configureSockets()

    val repo = NoteRepo()
    val noteService = NoteService(repo)
    val adminService = AdminService(repo, environment)
    configureRouting(noteService, adminService)
}
