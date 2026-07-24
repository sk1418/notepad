package sk1418.akcloud.notepad

import org.jetbrains.exposed.sql.transactions.transaction
import sk1418.akcloud.notepad.data.NoteRepo
import sk1418.akcloud.notepad.data.toNote
import sk1418.akcloud.notepad.model.Note
import sk1418.akcloud.notepad.model.SetKeyRequest
import sk1418.akcloud.notepad.model.SetPasswordRequest
import kotlin.random.Random
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

val charPool = ('a'..'z') + ('0'..'9')
const val KEY_LENGTH = 7
const val SHARE_LENGTH = 12

@OptIn(ExperimentalTime::class)
class NoteService(val repo: NoteRepo) {
    fun loadNote(noteKey: String?): Note = transaction {
        val key = noteKey ?: generateNewKey()
        val entity = repo.loadNoteByKey(key)
        if (entity != null) entity.toNote(hideContent = entity.password != null)
        else Note(id = 0, noteKey = key, readOnlyUrl = null, content = "", lastUpdateTs = Clock.System.now())
    }

    fun unlockNote(key: String, password: String): Note = transaction {
        val entity = repo.loadNoteByKey(key) ?: throw NoteNotFoundException(key)
        if (entity.password != password) throw InvalidPasswordException(key)
        entity.toNote()
    }

    fun generateShareUrl(noteKey: String): String = transaction {
        val entity = repo.loadNoteByKey(noteKey) ?: repo.createEmptyNote(noteKey)
        entity.readOnlyUrl ?: run {
            var url = createOneKey(SHARE_LENGTH)
            while (repo.countReadOnlyUrl(url) != 0L) url = createOneKey(SHARE_LENGTH)
            repo.setReadOnlyUrl(noteKey, url)
            url
        }
    }

    fun loadByShareUrl(url: String): Note = transaction {
        val entity = repo.loadNoteByReadOnlyUrl(url) ?: throw NoteNotFoundException(url)
        entity.toNote()
    }

    fun setPassword(key: String, passwordReq: SetPasswordRequest) = transaction {
        val entity = repo.loadNoteByKey(key) ?: repo.createEmptyNote(key)
        if (entity.password != null && entity.password != passwordReq.currentPassword) {
            throw InvalidPasswordException(key)
        }
        if (passwordReq.password.isEmpty())
            repo.clearPassword(key)
        else
            repo.setPassword(key, passwordReq.password)
    }

    fun updateContent(key: String, content: String) = transaction {
        val existing = repo.loadNoteByKey(key)
        if (content.isEmpty()) {
            if (existing != null && existing.password == null && existing.readOnlyUrl == null) {
                repo.deleteByKeys(listOf(key))
            } else if (existing != null) {
                repo.updateNote(key, content)
            }
            // no row + empty content → nothing to save
            return@transaction
        }
        if (existing == null) repo.createEmptyNote(key)
        repo.updateNote(key, content)
    }

    fun updateNoteKey(oldKey: String, keyReq: SetKeyRequest) = transaction {
        if (repo.countNoteKey(keyReq.key) != 0L) throw NoteKeyExistsException(keyReq.key)
        // Auto-create if user renames a not-yet-persisted note
        if (repo.loadNoteByKey(oldKey) == null) repo.createEmptyNote(oldKey)
        repo.updateNoteKey(oldKey, keyReq.key)
    }

    private fun createOneKey(length: Int = KEY_LENGTH) = (1..length).map {
        Random.nextInt(charPool.size).let { charPool[it] }
    }.joinToString("")

    private fun generateNewKey(): String {
        var newKey = createOneKey()
        while (repo.countNoteKey(newKey) != 0L)
            newKey = createOneKey()
        return newKey
    }

}