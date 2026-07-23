package sk1418.akcloud.notepad

import io.ktor.server.application.ApplicationEnvironment
import org.jetbrains.exposed.sql.transactions.transaction
import sk1418.akcloud.notepad.data.NoteRepo
import sk1418.akcloud.notepad.model.NoteSummary

private const val PREVIEW_LEN = 200

class AdminService(private val repo: NoteRepo, env: ApplicationEnvironment) {
    private val adminPassword: String? =
        env.config.propertyOrNull("admin.password")?.getString()?.takeIf { it.isNotBlank() }

    val enabled: Boolean get() = adminPassword != null

    fun verifyLogin(password: String) {
        val expected = adminPassword ?: throw AdminDisabledException()
        if (password != expected) throw AdminUnauthorizedException()
    }

    fun listSummaries(): List<NoteSummary> = transaction {
        repo.listAll().map {
            NoteSummary(
                id = it.id.value,
                noteKey = it.noteKey,
                preview = it.content.take(PREVIEW_LEN),
                contentLength = it.content.length,
                password = it.password,
                readOnlyUrl = it.readOnlyUrl,
                lastUpdateTs = it.lastUpdateTs,
            )
        }
    }

    fun deleteNotes(keys: List<String>): Int = transaction { repo.deleteByKeys(keys) }

    fun getContent(key: String): String = transaction {
        val e = repo.loadNoteByKey(key) ?: throw NoteNotFoundException(key)
        e.content
    }

    fun setNotePassword(key: String, password: String) = transaction {
        repo.loadNoteByKey(key) ?: throw NoteNotFoundException(key)
        if (password.isBlank()) repo.clearPassword(key) else repo.setPassword(key, password)
    }
}
