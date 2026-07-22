package sk1418.akcloud.notepad.data

import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import sk1418.akcloud.notepad.NoteNotFoundException
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

@OptIn(ExperimentalTime::class)
class NoteRepo {
    fun countNoteKey(noteKey: String): Long = NoteEntity.count(NoteTable.noteKey eq noteKey)
    fun countReadOnlyUrl(url: String): Long = NoteEntity.count(NoteTable.readOnlyUrl eq url)

    fun createEmptyNote(noteKey: String): NoteEntity = NoteEntity.new {
        this.noteKey = noteKey
        this.content = ""
        this.password = null
        this.lastUpdateTs = Clock.System.now()
    }

    fun loadNoteByKey(noteKey: String): NoteEntity? =
        NoteEntity.find { NoteTable.noteKey eq noteKey }.firstOrNull()

    fun loadNoteByReadOnlyUrl(url: String): NoteEntity? =
        NoteEntity.find { NoteTable.readOnlyUrl eq url }.firstOrNull()

    fun setReadOnlyUrl(key: String, url: String) = mutate(key, bumpTs = false) { readOnlyUrl = url }
    fun setPassword(key: String, password: String) = mutate(key) { this.password = password }
    fun clearPassword(key: String) = mutate(key) { this.password = null }
    fun updateNote(key: String, content: String) = mutate(key) { this.content = content }
    fun updateNoteKey(oldKey: String, newKey: String) = mutate(oldKey) { noteKey = newKey }

    private inline fun mutate(key: String, bumpTs: Boolean = true, block: NoteEntity.() -> Unit) {
        val e = loadNoteByKey(key) ?: throw NoteNotFoundException(key)
        e.block()
        if (bumpTs) e.lastUpdateTs = Clock.System.now()
    }
}