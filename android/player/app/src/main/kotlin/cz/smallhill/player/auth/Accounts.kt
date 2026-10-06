package cz.smallhill.player.auth

import android.content.Context
import androidx.core.content.edit
import cz.smallhill.player.json
import cz.smallhill.player.onedrive.Folder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable

@Serializable
data class Account(
    val id: String,
    val key: String,
    val name: String,
    val username: String,
    val refreshToken: String? = null,
    val top: List<Folder> = emptyList(),
) {
    val needsSignIn get() = refreshToken == null
    val topFolderId get() = top.lastOrNull()?.id ?: "root"
}

@Serializable
data class PendingSignIn(val state: String, val verifier: String)

class Accounts(context: Context) {
    private val prefs = context.getSharedPreferences("accounts", Context.MODE_PRIVATE)
    private val _list = MutableStateFlow(load())
    val list: StateFlow<List<Account>> = _list.asStateFlow()

    private fun load(): List<Account> =
        prefs.getString("list", null)
            ?.let { runCatching { json.decodeFromString<List<Account>>(it) }.getOrNull() }
            ?: emptyList()

    fun get(id: String): Account? = _list.value.find { it.id == id }

    @Synchronized
    private fun update(transform: (List<Account>) -> List<Account>) {
        val next = transform(_list.value)
        prefs.edit { putString("list", json.encodeToString(next)) }
        _list.value = next
    }

    fun signedIn(tokens: TokenResponse) {
        val claims = tokens.idToken?.let(OAuth::claims) ?: IdClaims()
        val key = "${claims.tid}.${claims.oid}"
        update { accounts ->
            val existing = accounts.find { it.key == key }
            val account = Account(
                id = existing?.id ?: OAuth.randomToken().take(12),
                key = key,
                name = claims.name ?: existing?.name ?: "",
                username = claims.username ?: existing?.username ?: "",
                refreshToken = tokens.refreshToken,
                top = existing?.top ?: emptyList(),
            )
            if (existing == null) accounts + account else accounts.map { if (it.key == key) account else it }
        }
    }

    fun setRefreshToken(id: String, refreshToken: String?) =
        update { accounts -> accounts.map { if (it.id == id) it.copy(refreshToken = refreshToken) else it } }

    fun setTop(id: String, top: List<Folder>) =
        update { accounts -> accounts.map { if (it.id == id) it.copy(top = top) else it } }

    fun remove(id: String) = update { accounts -> accounts.filterNot { it.id == id } }

    var pending: PendingSignIn?
        get() = prefs.getString("pending", null)?.let { runCatching { json.decodeFromString<PendingSignIn>(it) }.getOrNull() }
        set(value) {
            prefs.edit { putString("pending", value?.let { json.encodeToString(it) }) }
        }
}
