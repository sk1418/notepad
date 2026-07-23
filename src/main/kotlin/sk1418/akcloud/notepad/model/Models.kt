package sk1418.akcloud.notepad.model

import kotlinx.serialization.Serializable
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

@Serializable
@OptIn(ExperimentalTime::class)
data class Note(
    val id: Int,
    val noteKey: String,
    var readOnlyUrl: String?,
    var content: String,
    var lastUpdateTs: Instant,
    val hasPassword: Boolean = false,
    val locked: Boolean = false,
)

@Serializable
data class SetPasswordRequest(val password: String, val currentPassword: String? = null)

@Serializable
data class SetKeyRequest(val key: String)

@Serializable
data class UnlockRequest(val password: String)

@Serializable
data class AdminLoginRequest(val password: String)

@Serializable
data class DeleteNotesRequest(val keys: List<String>)

@Serializable
data class AdminSetPasswordRequest(val password: String)

@Serializable
data class NoteContentResponse(val noteKey: String, val content: String)

@Serializable
@OptIn(ExperimentalTime::class)
data class NoteSummary(
    val id: Int,
    val noteKey: String,
    val preview: String,
    val contentLength: Int,
    val password: String?,
    val readOnlyUrl: String?,
    val lastUpdateTs: Instant,
)