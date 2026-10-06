package cz.smallhill.player

import cz.smallhill.player.auth.OAuth
import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OAuthTest {
    @Test
    fun computesS256Challenge() {
        assertEquals(
            "ktG39pELbAYWFtXDAr6vpirT4eX6azD-A7gc4A_e1fg",
            OAuth.challenge("dBjftJeZ4CVP-mJ0kNMqfBk2HE57qUIHk2vM8Pc6g5Y"),
        )
    }

    @Test
    fun buildsAuthorizeUrl() {
        val url = OAuth.authorizeUrl("state1", "verifier", null)
        assertTrue(url.startsWith("${Config.AUTHORITY}/authorize?"))
        assertTrue("redirect_uri=cz.smallhill.player%3A%2F%2Fauth" in url)
        assertTrue("prompt=select_account" in url)
        assertTrue("state=state1" in url)
    }

    @Test
    fun readsIdTokenClaims() {
        val payload = Base64.getUrlEncoder().withoutPadding()
            .encodeToString("""{"oid":"o","tid":"t","name":"Martin","preferred_username":"m@example.com"}""".toByteArray())
        val claims = OAuth.claims("header.$payload.signature")
        assertEquals("o", claims.oid)
        assertEquals("m@example.com", claims.username)
    }
}
