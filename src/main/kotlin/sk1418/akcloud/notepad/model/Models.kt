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