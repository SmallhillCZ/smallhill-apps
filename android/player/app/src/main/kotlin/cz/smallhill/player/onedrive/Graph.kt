package cz.smallhill.player.onedrive

import cz.smallhill.player.Config
import cz.smallhill.player.Http
import cz.smallhill.player.HttpException
import cz.smallhill.player.auth.Accounts
import cz.smallhill.player.auth.OAuth
import cz.smallhill.player.auth.SignInExpired
import cz.smallhill.player.json
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

class Graph(private val accounts: Accounts) {
    private class Cached<T>(val value: T, val until: Long)

    private val tokens = ConcurrentHashMap<String, Cached<String>>()
    private val folders = ConcurrentHashMap<String, Cached<List<DriveItem>>>()
    private val downloads = ConcurrentHashMap<String, Cached<String>>()

    fun children(accountId: String, folderId: String, fresh: Boolean = false): List<DriveItem> {
        val key = "$accountId/$folderId"
        folders[key]?.takeIf { !fresh && it.until > now() }?.let { return it.value }
        val items = mutableListOf<DriveItem>()
        var url: String? = "${Config.GRAPH}/me/drive/items/${encode(folderId)}/children?\$select=$SELECT&\$top=500"
        while (url != null) {
            val page = json.decodeFromString<DrivePage>(get(accountId, url))
            items += page.value
            url = page.nextLink
        }
        folders[key] = Cached(items, now() + FOLDER_TTL)
        return items
    }

    fun search(accountId: String, query: String): List<DriveItem> {
        val q = encode(query.replace("'", "''"))
        val url = "${Config.GRAPH}/me/drive/root/search(q='$q')?\$select=$SELECT,parentReference&\$top=200"
        return json.decodeFromString<DrivePage>(get(accountId, url)).value
    }

    fun item(accountId: String, itemId: String): DriveItem =
        json.decodeFromString(get(accountId, "${Config.GRAPH}/me/drive/items/${encode(itemId)}"))

    fun downloadUrl(accountId: String, itemId: String): String {
        val key = "$accountId/$itemId"
        downloads[key]?.takeIf { it.until > now() }?.let { return it.value }
        val url = item(accountId, itemId).downloadUrl ?: throw HttpException(404, "No download URL")
        downloads[key] = Cached(url, now() + DOWNLOAD_TTL)
        return url
    }

    private fun get(accountId: String, url: String): String = try {
        Http.get(url, token(accountId))
    } catch (error: HttpException) {
        if (error.code != 401) throw error
        tokens.remove(accountId)
        Http.get(url, token(accountId))
    }

    @Synchronized
    private fun token(accountId: String): String {
        tokens[accountId]?.takeIf { it.until > now() }?.let { return it.value }
        val refreshToken = accounts.get(accountId)?.refreshToken ?: throw SignInExpired()
        val response = try {
            OAuth.refresh(refreshToken)
        } catch (error: SignInExpired) {
            accounts.setRefreshToken(accountId, null)
            throw error
        }
        response.refreshToken?.let { accounts.setRefreshToken(accountId, it) }
        tokens[accountId] = Cached(response.accessToken, now() + (response.expiresIn - 300).coerceAtLeast(60) * 1000)
        return response.accessToken
    }

    private fun now() = System.currentTimeMillis()

    private fun encode(id: String) = URLEncoder.encode(id, "UTF-8")

    private companion object {
        const val SELECT = "id,name,size,folder,file,audio"
        const val FOLDER_TTL = 5 * 60 * 1000L
        const val DOWNLOAD_TTL = 30 * 60 * 1000L
    }
}
