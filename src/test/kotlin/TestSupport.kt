package sk1418.akcloud.notepad

import io.ktor.client.HttpClient
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.transactions.transaction
import sk1418.akcloud.notepad.data.NoteTable
import java.util.concurrent.atomic.AtomicInteger

private val dbCounter = AtomicInteger(0)

fun testConfig(adminPassword: String? = null): MapApplicationConfig {
    val dbName = "test_${dbCounter.incrementAndGet()}_${System.nanoTime()}"
    val cfg = MapApplicationConfig(
        "database.url" to "jdbc:h2:mem:$dbName;DB_CLOSE_DELAY=-1;MODE=MySQL",
        "database.driver" to "org.h2.Driver",
        "database.user" to "",
        "database.password" to "",
        "session.signKey" to "0123456789abcdef0123456789abcdef",
    )
    if (adminPassword != null) cfg.put("admin.password", adminPassword)
    return cfg
}

fun withTestApp(adminPassword: String? = null, block: suspend ApplicationTestBuilder.(HttpClient) -> Unit) = testApplication {
    environment { config = testConfig(adminPassword) }
    application {
        module()
        transaction { SchemaUtils.create(NoteTable) }
    }
    val client = createClient {
        install(HttpCookies)
        install(WebSockets)
    }
    block(client)
}
