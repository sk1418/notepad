package sk1418.akcloud.notepad

import io.ktor.client.plugins.websocket.webSocket
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.jsonObject
import sk1418.akcloud.notepad.model.Note
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class NoteRoutesTest {

    private val json = Json { ignoreUnknownKeys = true }

    private suspend fun io.ktor.client.HttpClient.loadNote(key: String? = null): Note {
        val path = if (key == null) "/" else "/$key"
        val res = post(path)
        assertEquals(HttpStatusCode.OK, res.status)
        return json.decodeFromString(Note.serializer(), res.bodyAsText())
    }

    @Test
    fun post_root_creates_note() = withTestApp { client ->
        val n = client.loadNote()
        assertEquals(7, n.noteKey.length)
        assertTrue(!n.hasPassword)
    }

    @Test
    fun post_with_key_is_idempotent() = withTestApp { client ->
        val a = client.loadNote("mykey01")
        val b = client.loadNote("mykey01")
        assertEquals(a.id, b.id)
        assertEquals("mykey01", a.noteKey)
    }

    @Test
    fun unlock_wrong_password_returns_401() = withTestApp { client ->
        client.loadNote("lockit1")
        client.put("/set-password") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"secret"}""")
        }
        val res = client.post("/lockit1/unlock") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"wrong"}""")
        }
        assertEquals(HttpStatusCode.Unauthorized, res.status)
    }

    @Test
    fun unlock_correct_password_returns_content() = withTestApp { client ->
        val n = client.loadNote("unlok01")
        client.put("/set-password") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"pw"}""")
        }
        // put some content via WS
        client.webSocket("/ws/${n.noteKey}") {
            send(Frame.Text("body content"))
            val reply = incoming.receive() as Frame.Text
            assertEquals("ok", reply.readText())
        }
        val res = client.post("/unlok01/unlock") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"pw"}""")
        }
        assertEquals(HttpStatusCode.OK, res.status)
        val note = json.decodeFromString(Note.serializer(), res.bodyAsText())
        assertEquals("body content", note.content)
    }

    @Test
    fun set_password_without_session_returns_401() = withTestApp { client ->
        // No prior POST /, no cookie yet
        val res = client.put("/set-password") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"pw"}""")
        }
        assertEquals(HttpStatusCode.Unauthorized, res.status)
    }

    @Test
    fun set_noteKey_conflict_returns_409() = withTestApp { client ->
        // persist "takenkk" via WS so it truly exists in DB
        client.loadNote("takenkk")
        client.webSocket("/ws/takenkk") { send(Frame.Text("seed")); incoming.receive() }
        client.loadNote("origkey")
        val res = client.put("/set-noteKey") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"key":"takenkk"}""")
        }
        assertEquals(HttpStatusCode.Conflict, res.status)
    }

    @Test
    fun set_noteKey_renames() = withTestApp { client ->
        client.loadNote("origin1")
        val res = client.put("/set-noteKey") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"key":"renamed"}""")
        }
        assertEquals(HttpStatusCode.OK, res.status)
        val reloaded = client.loadNote("renamed")
        assertEquals("renamed", reloaded.noteKey)
    }

    @Test
    fun generate_share_returns_url() = withTestApp { client ->
        client.loadNote("sharing")
        val res = client.post("/generate-share")
        assertEquals(HttpStatusCode.OK, res.status)
        val obj = json.parseToJsonElement(res.bodyAsText()).jsonObject
        val url = obj["readOnlyUrl"]?.jsonPrimitive?.content
        assertNotNull(url)
        assertEquals(SHARE_LENGTH, url.length)
    }

    @Test
    fun share_endpoint_loads_note() = withTestApp { client ->
        val n = client.loadNote("shr0001")
        client.webSocket("/ws/${n.noteKey}") {
            send(Frame.Text("public body"))
            incoming.receive()
        }
        val share = client.post("/generate-share")
        val url = json.parseToJsonElement(share.bodyAsText()).jsonObject["readOnlyUrl"]!!.jsonPrimitive.content
        val res = client.post("/share/$url")
        assertEquals(HttpStatusCode.OK, res.status)
        val note = json.decodeFromString(Note.serializer(), res.bodyAsText())
        assertEquals("public body", note.content)
    }

    @Test
    fun share_missing_returns_404() = withTestApp { client ->
        val res = client.post("/share/no-such-url")
        assertEquals(HttpStatusCode.NotFound, res.status)
    }

    @Test
    fun unlock_missing_note_returns_404() = withTestApp { client ->
        val res = client.post("/ghost123/unlock") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"x"}""")
        }
        assertEquals(HttpStatusCode.NotFound, res.status)
    }

    @Test
    fun ws_updates_content() = withTestApp { client ->
        val n = client.loadNote("wskey01")
        client.webSocket("/ws/${n.noteKey}") {
            send(Frame.Text("edit-1"))
            assertEquals("ok", (incoming.receive() as Frame.Text).readText())
            send(Frame.Text("edit-2"))
            assertEquals("ok", (incoming.receive() as Frame.Text).readText())
        }
        val reloaded = client.loadNote("wskey01")
        assertEquals("edit-2", reloaded.content)
    }

    @Test
    fun ws_without_session_is_closed() = withTestApp { client ->
        // No POST / — no session cookie. Server closes with policy violation.
        var closed = false
        try {
            client.webSocket("/ws/nosessi") {
                // If we get here, server accepted — try to receive close reason
                val f = incoming.receive()
                if (f is Frame.Close) closed = true
            }
        } catch (_: Exception) {
            closed = true
        }
        assertTrue(closed, "WS must be rejected without valid session")
    }

    @Test
    fun ws_wrong_key_is_closed() = withTestApp { client ->
        client.loadNote("realkey")  // session bound to realkey
        var closed = false
        try {
            client.webSocket("/ws/otherky") {
                val f = incoming.receive()
                if (f is Frame.Close) closed = true
            }
        } catch (_: Exception) {
            closed = true
        }
        assertTrue(closed, "WS must be rejected for mismatched key")
    }
}
