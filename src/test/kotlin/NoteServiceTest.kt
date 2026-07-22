package sk1418.akcloud.notepad

import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import org.junit.After
import org.junit.Before
import sk1418.akcloud.notepad.data.NoteRepo
import sk1418.akcloud.notepad.data.NoteTable
import sk1418.akcloud.notepad.model.SetKeyRequest
import sk1418.akcloud.notepad.model.SetPasswordRequest
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class NoteServiceTest {
    private lateinit var service: NoteService
    private val counter = AtomicInteger(0)

    @Before
    fun setup() {
        val name = "svc_${counter.incrementAndGet()}_${System.nanoTime()}"
        Database.connect("jdbc:h2:mem:$name;DB_CLOSE_DELAY=-1", driver = "org.h2.Driver")
        transaction { SchemaUtils.create(NoteTable) }
        service = NoteService(NoteRepo())
    }

    @After
    fun cleanup() {
        transaction { SchemaUtils.drop(NoteTable) }
    }

    @Test
    fun loadNote_null_key_creates_new() {
        val n = service.loadNote(null)
        assertEquals(KEY_LENGTH, n.noteKey.length)
        assertEquals("", n.content)
        assertTrue(!n.locked)
    }

    @Test
    fun loadNote_existing_returns_same() {
        val a = service.loadNote("abc1234")
        val b = service.loadNote("abc1234")
        assertEquals(a.id, b.id)
    }

    @Test
    fun loadNote_hides_content_when_password_set() = runBlocking {
        val n = service.loadNote("lock123")
        service.setPassword(n.noteKey, SetPasswordRequest("secret"))
        service.updateContent(n.noteKey, "hidden text")
        val reloaded = service.loadNote(n.noteKey)
        assertTrue(reloaded.locked)
        assertEquals("", reloaded.content)
        assertTrue(reloaded.hasPassword)
    }

    @Test
    fun unlock_correct_pw_returns_content() {
        val n = service.loadNote("unlock1")
        service.setPassword(n.noteKey, SetPasswordRequest("pw"))
        service.updateContent(n.noteKey, "hello")
        val ok = service.unlockNote(n.noteKey, "pw")
        assertEquals("hello", ok.content)
    }

    @Test
    fun unlock_wrong_pw_throws() {
        val n = service.loadNote("unlock2")
        service.setPassword(n.noteKey, SetPasswordRequest("pw"))
        assertFailsWith<InvalidPasswordException> { service.unlockNote(n.noteKey, "bad") }
    }

    @Test
    fun unlock_missing_note_throws() {
        assertFailsWith<NoteNotFoundException> { service.unlockNote("nope999", "x") }
    }

    @Test
    fun updateNoteKey_conflict_throws() {
        service.loadNote("keyA123")
        service.loadNote("keyB123")
        assertFailsWith<NoteKeyExistsException> {
            service.updateNoteKey("keyA123", SetKeyRequest("keyB123"))
        }
    }

    @Test
    fun updateNoteKey_renames() {
        service.loadNote("oldkey1")
        service.updateContent("oldkey1", "body")
        service.updateNoteKey("oldkey1", SetKeyRequest("newkey1"))
        val reloaded = service.loadNote("newkey1")
        assertEquals("body", reloaded.content)
        // old key gone → loading it creates fresh empty note
        val fresh = service.loadNote("oldkey1")
        assertEquals("", fresh.content)
    }

    @Test
    fun generateShareUrl_creates_and_is_idempotent() {
        service.loadNote("share01")
        val u1 = service.generateShareUrl("share01")
        val u2 = service.generateShareUrl("share01")
        assertEquals(SHARE_LENGTH, u1.length)
        assertEquals(u1, u2)
    }

    @Test
    fun loadByShareUrl_returns_full_content_even_when_locked() {
        val n = service.loadNote("share02")
        service.updateContent(n.noteKey, "shared body")
        service.setPassword(n.noteKey, SetPasswordRequest("pw"))
        val url = service.generateShareUrl(n.noteKey)
        val loaded = service.loadByShareUrl(url)
        assertEquals("shared body", loaded.content)
    }

    @Test
    fun loadByShareUrl_missing_throws() {
        assertFailsWith<NoteNotFoundException> { service.loadByShareUrl("does-not-exist") }
    }

    @Test
    fun updateContent_persists_and_bumps_ts() {
        val n = service.loadNote("upd0001")
        val ts0 = n.lastUpdateTs
        Thread.sleep(1100)
        service.updateContent(n.noteKey, "new body")
        val reloaded = service.loadNote(n.noteKey)
        assertEquals("new body", reloaded.content)
        assertTrue(reloaded.lastUpdateTs > ts0)
    }

    @Test
    fun setPassword_new_when_none_exists() {
        val n = service.loadNote("noPwd01")
        service.setPassword(n.noteKey, SetPasswordRequest("first"))
        val ok = service.unlockNote(n.noteKey, "first")
        assertEquals(n.noteKey, ok.noteKey)
    }

    @Test
    fun setPassword_change_requires_current() {
        val n = service.loadNote("chgPwd1")
        service.setPassword(n.noteKey, SetPasswordRequest("orig"))
        assertFailsWith<InvalidPasswordException> {
            service.setPassword(n.noteKey, SetPasswordRequest("new", currentPassword = "wrong"))
        }
        assertFailsWith<InvalidPasswordException> {
            service.setPassword(n.noteKey, SetPasswordRequest("new"))
        }
        service.setPassword(n.noteKey, SetPasswordRequest("new", currentPassword = "orig"))
        service.unlockNote(n.noteKey, "new")
    }

    @Test
    fun setPassword_empty_removes_password() {
        val n = service.loadNote("rmPwd01")
        service.setPassword(n.noteKey, SetPasswordRequest("orig"))
        service.setPassword(n.noteKey, SetPasswordRequest("", currentPassword = "orig"))
        val reloaded = service.loadNote(n.noteKey)
        assertTrue(!reloaded.hasPassword)
        assertTrue(!reloaded.locked)
    }

    @Test
    fun setPassword_empty_without_current_throws_when_protected() {
        val n = service.loadNote("rmPwd02")
        service.setPassword(n.noteKey, SetPasswordRequest("orig"))
        assertFailsWith<InvalidPasswordException> {
            service.setPassword(n.noteKey, SetPasswordRequest("", currentPassword = "wrong"))
        }
    }

    @Test
    fun generateShareUrl_missing_note_throws() {
        assertFailsWith<NoteNotFoundException> { service.generateShareUrl("ghost01") }
        assertNull(null) // silence unused import
        assertNotNull(service)
    }
}
