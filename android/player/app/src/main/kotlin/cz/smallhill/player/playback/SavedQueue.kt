package cz.smallhill.player.playback

import android.content.Context
import androidx.core.content.edit
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import cz.smallhill.player.json
import kotlinx.serialization.Serializable

@Serializable
data class SavedItem(val id: String, val title: String?, val artist: String?, val album: String?, val durationMs: Long?)

@Serializable
data class SavedQueue(val items: List<SavedItem>, val index: Int, val positionMs: Long)

class QueueStore(context: Context) {
    private val prefs = context.getSharedPreferences("queue", Context.MODE_PRIVATE)

    fun load(): SavedQueue? =
        prefs.getString("queue", null)
            ?.let { runCatching { json.decodeFromString<SavedQueue>(it) }.getOrNull() }
            ?.takeIf { it.index in it.items.indices }

    fun save(queue: SavedQueue?) {
        prefs.edit { putString("queue", queue?.let { json.encodeToString(it) }) }
    }
}

fun MediaItem.toSaved() = SavedItem(
    mediaId,
    mediaMetadata.title?.toString(),
    mediaMetadata.artist?.toString(),
    mediaMetadata.albumTitle?.toString(),
    mediaMetadata.durationMs,
)

fun SavedItem.toMediaItem(): MediaItem = MediaItem.Builder()
    .setMediaId(id)
    .setMediaMetadata(
        MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setAlbumTitle(album)
            .setDurationMs(durationMs)
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
            .build(),
    )
    .build()
