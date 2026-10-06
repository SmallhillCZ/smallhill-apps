package cz.smallhill.player.auth

import cz.smallhill.player.Config
import cz.smallhill.player.Http
import cz.smallhill.player.HttpException
import cz.smallhill.player.json
import java.io.IOException
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

class SignInExpired : IOException("Sign-in expired")

@Serializable
data class TokenResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_in") val expiresIn: Long = 3600,
    @SerialName("id_token") val idToken: String? = null,
)

@Serializable
data class IdClaims(
    val oid: String? = null,
    val tid: String? = null,
    val name: String? = null,
    @SerialName("preferred_username") val username: String? = null,
)

object OAuth {
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()

    fun randomToken(): String = ByteArray(32).also(random::nextBytes).let(encoder::encodeToString)

    fun challenge(verifier: String): String =
        encoder.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))

    fun authorizeUrl(state: String, verifier: String, loginHint: String?): String {
        val params = buildMap {
            put("client_id", Config.CLIENT_ID)
            put("response_type", "code")
            put("redirect_uri", Config.REDIRECT_URI)
            put("response_mode", "query")
            put("scope", Config.SCOPES)
            put("state", state)
            put("code_challenge", challenge(verifier))
            put("code_challenge_method", "S256")
            if (loginHint != null) put("login_hint", loginHint) else put("prompt", "select_account")
        }
        return "${Config.AUTHORITY}/authorize?" +
            params.entries.joinToString("&") { (key, value) -> "$key=${URLEncoder.encode(value, "UTF-8")}" }
    }

    fun redeem(code: String, verifier: String): TokenResponse = token(
        mapOf(
            "grant_type" to "authorization_code",
            "code" to code,
            "code_verifier" to verifier,
            "redirect_uri" to Config.REDIRECT_URI,
        ),
    )

    fun refresh(refreshToken: String): TokenResponse = token(
        mapOf("grant_type" to "refresh_token", "refresh_token" to refreshToken),
    )

    private fun token(form: Map<String, String>): TokenResponse {
        val body = try {
            Http.postForm(
                "${Config.AUTHORITY}/token",
                form + mapOf("client_id" to Config.CLIENT_ID, "scope" to Config.SCOPES),
            )
        } catch (error: HttpException) {
            if (error.code == 400 && "invalid_grant" in error.body) throw SignInExpired()
            throw error
        }
        return json.decodeFromString(body)
    }

    fun claims(idToken: String): IdClaims {
        val payload = idToken.split('.').getOrNull(1) ?: return IdClaims()
        return runCatching {
            json.decodeFromString<IdClaims>(String(Base64.getUrlDecoder().decode(payload)))
        }.getOrDefault(IdClaims())
    }
}
