package cz.smallhill.player.onedrive

import java.text.Collator
import java.util.Locale
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DriveItem(
    val id: String,
    val name: String,
    val size: Long? = null,
    val folder: FolderFacet? = null,
    val file: FileFacet? = null,
    val audio: AudioFacet? = null,
    val parentReference: ParentReference? = null,
    @SerialName("@microsoft.graph.downloadUrl") val downloadUrl: String? = null,
)

@Serializable
data class ParentReference(val id: String? = null)

@Serializable
data class FolderFacet(val childCount: Int? = null)

@Serializable
data class FileFacet(val mimeType: String? = null)

@Serializable
data class AudioFacet(
    val title: String? = null,
    val artist: String? = null,
    val album: String? = null,
    val albumArtist: String? = null,
    val duration: Long? = null,
    val track: Int? = null,
    val disc: Int? = null,
)

@Serializable
data class DrivePage(
    val value: List<DriveItem>,
    @SerialName("@odata.nextLink") val nextLink: String? = null,
)

@Serializable
data class Folder(val id: String, val name: String)

data class Track(
    val id: String,
    val name: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long?,
)

private val AUDIO_EXTENSIONS = setOf("mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac", "weba")

fun extension(name: String): String {
    val dot = name.lastIndexOf('.')
    return if (dot < 0) "" else name.substring(dot + 1).lowercase(Locale.ROOT)
}

fun isAudio(item: DriveItem): Boolean {
    val file = item.file ?: return false
    return extension(item.name) in AUDIO_EXTENSIONS || file.mimeType?.startsWith("audio/") == true
}

fun toTrack(item: DriveItem): Track {
    val dot = item.name.lastIndexOf('.')
    val base = if (dot > 0) item.name.substring(0, dot) else item.name
    val audio = item.audio
    return Track(
        id = item.id,
        name = item.name,
        title = audio?.title?.trim()?.ifEmpty { null } ?: base,
        artist = audio?.artist?.trim()?.ifEmpty { null } ?: audio?.albumArtist?.trim() ?: "",
        album = audio?.album?.trim() ?: "",
        durationMs = audio?.duration?.takeIf { it > 0 },
    )
}

private val collator = Collator.getInstance(Locale.ROOT).apply { strength = Collator.PRIMARY }

fun naturalCompare(a: String, b: String): Int {
    var i = 0
    var j = 0
    while (i < a.length && j < b.length) {
        if (a[i].isDigit() && b[j].isDigit()) {
            val startA = i
            val startB = j
            while (i < a.length && a[i].isDigit()) i++
            while (j < b.length && b[j].isDigit()) j++
            val numberA = a.substring(startA, i).trimStart('0')
            val numberB = b.substring(startB, j).trimStart('0')
            if (numberA.length != numberB.length) return numberA.length - numberB.length
            val compared = numberA.compareTo(numberB)
            if (compared != 0) return compared
        } else {
            val compared = collator.compare(a[i].toString(), b[j].toString())
            if (compared != 0) return compared
            i++
            j++
        }
    }
    return (a.length - i) - (b.length - j)
}

fun sortFolders(items: List<DriveItem>): List<DriveItem> =
    items.filter { it.folder != null }.sortedWith { a, b -> naturalCompare(a.name, b.name) }

fun sortTracks(items: List<DriveItem>): List<DriveItem> =
    items.filter(::isAudio).sortedWith(
        compareBy<DriveItem>({ it.audio?.disc ?: 0 }, { it.audio?.track ?: 0 })
            .thenComparator { a, b -> naturalCompare(a.name, b.name) },
    )

fun formatTime(ms: Long?): String {
    if (ms == null || ms < 0) return "–:––"
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = (total % 60).toString().padStart(2, '0')
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:$s" else "$m:$s"
}
