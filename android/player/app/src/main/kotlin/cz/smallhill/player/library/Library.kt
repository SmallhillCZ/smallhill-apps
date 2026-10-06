package cz.smallhill.player.library

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import cz.smallhill.player.R
import cz.smallhill.player.auth.Account
import cz.smallhill.player.auth.Accounts
import cz.smallhill.player.onedrive.DriveItem
import cz.smallhill.player.onedrive.Graph
import cz.smallhill.player.onedrive.isAudio
import cz.smallhill.player.onedrive.sortFolders
import cz.smallhill.player.onedrive.sortTracks
import cz.smallhill.player.onedrive.toTrack

class Library(private val context: Context, private val accounts: Accounts, private val graph: Graph) {
    val root: MediaItem
        get() = folder(Node.Root, context.getString(R.string.library), null, MediaMetadata.MEDIA_TYPE_FOLDER_MIXED)

    fun children(parentId: String, fresh: Boolean = false): List<MediaItem>? = when (val node = Node.parse(parentId)) {
        Node.Root -> accounts.list.value.map(::account)
        is Node.Account -> accounts.get(node.accountId)?.let { folderChildren(it.id, it.topFolderId, fresh) }
        is Node.Folder -> folderChildren(node.accountId, node.folderId, fresh)
        else -> null
    }

    fun item(id: String): MediaItem? = when (val node = Node.parse(id)) {
        Node.Root -> root
        is Node.Account -> accounts.get(node.accountId)?.let(::account)
        is Node.Folder -> graph.item(node.accountId, node.folderId).let { folder(node, it.name, null) }
        is Node.Track -> track(node.accountId, node.folderId, graph.item(node.accountId, node.itemId))
        null -> null
    }

    fun folderTracks(node: Node.Track): List<MediaItem> =
        sortTracks(graph.children(node.accountId, node.folderId)).map { track(node.accountId, node.folderId, it) }

    fun search(query: String): List<MediaItem> =
        accounts.list.value.filterNot { it.needsSignIn }.flatMap { account ->
            runCatching { graph.search(account.id, query) }.getOrDefault(emptyList())
                .filter(::isAudio)
                .map { track(account.id, it.parentReference?.id ?: "root", it) }
        }.take(SEARCH_LIMIT)

    fun playable(item: MediaItem): MediaItem? {
        val node = Node.parse(item.mediaId) as? Node.Track ?: return null
        return item.buildUpon().setUri(uri(node)).build()
    }

    private fun folderChildren(accountId: String, folderId: String, fresh: Boolean): List<MediaItem> {
        val items = graph.children(accountId, folderId, fresh)
        return sortFolders(items).map { folder(Node.Folder(accountId, it.id), it.name, null) } +
            sortTracks(items).map { track(accountId, folderId, it) }
    }

    private fun account(account: Account): MediaItem {
        val subtitle = listOf(account.username, account.top.joinToString(" / ") { it.name })
            .filter { it.isNotEmpty() }
            .joinToString(" · ")
        return folder(Node.Account(account.id), context.getString(R.string.onedrive), subtitle)
    }

    private fun folder(
        node: Node,
        title: String,
        subtitle: String?,
        type: Int = MediaMetadata.MEDIA_TYPE_FOLDER_MIXED,
    ) = MediaItem.Builder()
        .setMediaId(node.id)
        .setMediaMetadata(
            MediaMetadata.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setIsBrowsable(true)
                .setIsPlayable(false)
                .setMediaType(type)
                .build(),
        )
        .build()

    private fun track(accountId: String, folderId: String, item: DriveItem): MediaItem {
        val track = toTrack(item)
        val node = Node.Track(accountId, folderId, item.id)
        return MediaItem.Builder()
            .setMediaId(node.id)
            .setUri(uri(node))
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(track.title)
                    .setArtist(track.artist.ifEmpty { null })
                    .setAlbumTitle(track.album.ifEmpty { null })
                    .setDurationMs(track.durationMs)
                    .setIsBrowsable(false)
                    .setIsPlayable(true)
                    .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
                    .build(),
            )
            .build()
    }

    companion object {
        const val SCHEME = "onedrive"
        private const val SEARCH_LIMIT = 100

        fun uri(node: Node.Track): Uri =
            Uri.Builder().scheme(SCHEME).authority(node.accountId).appendPath(node.itemId).build()
    }
}
