package sk1418.akcloud.notepad.plugins

import io.ktor.server.application.*
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import sk1418.akcloud.notepad.data.NoteTable

fun Application.configureDatabase() {
    val cfg = environment.config
    val url = cfg.property("database.url").getString()
    val driver = cfg.property("database.driver").getString()
    val user = cfg.propertyOrNull("database.user")?.getString().orEmpty()
    val password = cfg.propertyOrNull("database.password")?.getString().orEmpty()

    Database.connect(url = url, driver = driver, user = user, password = password)
    transaction { SchemaUtils.createMissingTablesAndColumns(NoteTable) }
}