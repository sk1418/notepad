package sk1418.akcloud.notepad.data

import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.dao.id.EntityID
import org.jetbrains.exposed.dao.id.IntIdTable
import sk1418.akcloud.notepad.model.Note
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

object NoteTable : IntIdTable("note", columnName = "id") {

    val noteKey = varchar("note_key", 64).uniqueIndex()
    val readOnlyUrl = varchar("read_only_url", 16).nullable().uniqueIndex()
    val content = largeText("content")
    val password = varchar("password", 128).nullable()

    @OptIn(ExperimentalTime::class)
    val lastUpdateTs = long("last_update_ts").transform(
        unwrap = { it.epochSeconds },
        wrap = { Instant.fromEpochSeconds(it, 0) }).default(Clock.System.now())
}

class NoteEntity(id: EntityID<Int>) : IntEntity(id) {
    companion object : IntEntityClass<NoteEntity>(NoteTable)

    var noteKey: String by NoteTable.noteKey
    var readOnlyUrl: String? by NoteTable.readOnlyUrl
    var content: String by NoteTable.content
    var password: String? by NoteTable.password

    @OptIn(ExperimentalTime::class)
    var lastUpdateTs: Instant by NoteTable.lastUpdateTs
}

@OptIn(ExperimentalTime::class)
fun NoteEntity.toNote(hideContent: Boolean = false) = Note(
    id = this.id.value,
    noteKey = this.noteKey,
    readOnlyUrl = this.readOnlyUrl,
    content = if (hideContent) "" else this.content,
    lastUpdateTs = this.lastUpdateTs,
    hasPassword = this.password != null,
    locked = hideContent,
)