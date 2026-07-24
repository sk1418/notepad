package sk1418.akcloud.notepad

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.websocket.Frame
import io.ktor.client.plugins.websocket.webSocket
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AdminRoutesTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun status_when_disabled() = withTestApp { client ->
        val res = client.get("/admin/status")
        val obj = json.parseToJsonElement(res.bodyAsText()).jsonObject
        assertEquals(false, obj["enabled"]!!.jsonPrimitive.content.toBoolean())
    }

    @Test
    fun login_disabled_returns_503() = withTestApp { client ->
        val r = client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"anything"}""")
        }
        assertEquals(HttpStatusCode.ServiceUnavailable, r.status)
    }

    @Test
    fun list_notes_requires_login() = withTestApp(adminPassword = "adminpw") { client ->
        val r = client.get("/admin/notes")
        assertEquals(HttpStatusCode.Unauthorized, r.status)
    }

    @Test
    fun login_wrong_pw_returns_401() = withTestApp(adminPassword = "adminpw") { client ->
        val r = client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"wrong"}""")
        }
        assertEquals(HttpStatusCode.Unauthorized, r.status)
    }

    @Test
    fun login_then_list_and_delete() = withTestApp(adminPassword = "adminpw") { client ->
        client.post("/n1")
        client.webSocket("/ws/n1") { send(Frame.Text("hello from n1")); incoming.receive() }
        client.post("/n2")
        client.webSocket("/ws/n2") { send(Frame.Text("hello from n2")); incoming.receive() }

        val login = client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"adminpw"}""")
        }
        assertEquals(HttpStatusCode.OK, login.status)

        val list = client.get("/admin/notes")
        assertEquals(HttpStatusCode.OK, list.status)
        val arr = json.parseToJsonElement(list.bodyAsText()).jsonArray
        assertEquals(2, arr.size)
        val keys = arr.map { it.jsonObject["noteKey"]!!.jsonPrimitive.content }.toSet()
        assertTrue(keys.containsAll(setOf("n1", "n2")))

        val del = client.post("/admin/notes/delete") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"keys":["n1"]}""")
        }
        assertEquals(HttpStatusCode.OK, del.status)
        val obj = json.parseToJsonElement(del.bodyAsText()).jsonObject
        assertEquals(1, obj["deleted"]!!.jsonPrimitive.content.toInt())

        val list2 = client.get("/admin/notes")
        val arr2 = json.parseToJsonElement(list2.bodyAsText()).jsonArray
        assertEquals(1, arr2.size)
        assertEquals("n2", arr2[0].jsonObject["noteKey"]!!.jsonPrimitive.content)
    }

    @Test
    fun logout_clears_session() = withTestApp(adminPassword = "adminpw") { client ->
        client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"adminpw"}""")
        }
        assertEquals(HttpStatusCode.OK, client.get("/admin/notes").status)
        client.post("/admin/logout")
        assertEquals(HttpStatusCode.Unauthorized, client.get("/admin/notes").status)
    }

    @Test
    fun preview_truncated_to_200_chars() = withTestApp(adminPassword = "adminpw") { client ->
        client.post("/big001")
        val long = "x".repeat(500)
        client.webSocket("/ws/big001") { send(Frame.Text(long)); incoming.receive() }
        client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"adminpw"}""")
        }
        val list = client.get("/admin/notes")
        val arr = json.parseToJsonElement(list.bodyAsText()).jsonArray
        val row = arr[0].jsonObject
        assertEquals(200, row["preview"]!!.jsonPrimitive.content.length)
        assertEquals(500, row["contentLength"]!!.jsonPrimitive.content.toInt())
    }

    @Test
    fun get_full_content_returns_all() = withTestApp(adminPassword = "adminpw") { client ->
        client.post("/big002")
        val long = "y".repeat(500)
        client.webSocket("/ws/big002") { send(Frame.Text(long)); incoming.receive() }
        client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"adminpw"}""")
        }
        val r = client.get("/admin/notes/big002/content")
        assertEquals(HttpStatusCode.OK, r.status)
        val obj = json.parseToJsonElement(r.bodyAsText()).jsonObject
        assertEquals("big002", obj["noteKey"]!!.jsonPrimitive.content)
        assertEquals(500, obj["content"]!!.jsonPrimitive.content.length)
    }

    @Test
    fun get_content_requires_login() = withTestApp(adminPassword = "adminpw") { client ->
        client.post("/x1")
        val r = client.get("/admin/notes/x1/content")
        assertEquals(HttpStatusCode.Unauthorized, r.status)
    }

    @Test
    fun admin_set_and_clear_password() = withTestApp(adminPassword = "adminpw") { client ->
        client.post("/pw001")
        client.webSocket("/ws/pw001") { send(Frame.Text("seed")); incoming.receive() }
        client.post("/admin/login") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"adminpw"}""")
        }
        // set
        val setR = client.post("/admin/notes/pw001/password") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":"secret"}""")
        }
        assertEquals(HttpStatusCode.OK, setR.status)
        var list = client.get("/admin/notes")
        var row = json.parseToJsonElement(list.bodyAsText()).jsonArray
            .first { it.jsonObject["noteKey"]!!.jsonPrimitive.content == "pw001" }.jsonObject
        assertEquals("secret", row["password"]!!.jsonPrimitive.content)
        // clear
        val clearR = client.post("/admin/notes/pw001/password") {
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            setBody("""{"password":""}""")
        }
        assertEquals(HttpStatusCode.OK, clearR.status)
        list = client.get("/admin/notes")
        row = json.parseToJsonElement(list.bodyAsText()).jsonArray
            .first { it.jsonObject["noteKey"]!!.jsonPrimitive.content == "pw001" }.jsonObject
        assertTrue(row["password"] is kotlinx.serialization.json.JsonNull)
    }
}
