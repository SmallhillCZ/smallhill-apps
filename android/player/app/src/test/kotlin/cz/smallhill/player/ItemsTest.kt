package cz.smallhill.player

import cz.smallhill.player.onedrive.AudioFacet
import cz.smallhill.player.onedrive.DriveItem
import cz.smallhill.player.onedrive.DrivePage
import cz.smallhill.player.onedrive.FileFacet
import cz.smallhill.player.onedrive.FolderFacet
import cz.smallhill.player.onedrive.formatTime
import cz.smallhill.player.onedrive.isAudio
import cz.smallhill.player.onedrive.sortFolders
import cz.smallhill.player.onedrive.sortTracks
import cz.smallhill.player.onedrive.toTrack
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ItemsTest {
    private fun file(name: String, mime: String? = null, audio: AudioFacet? = null) =
        DriveItem(id = name, name = name, file = FileFacet(mime), audio = audio)

    private fun folder(name: String) = DriveItem(id = name, name = name, folder = FolderFacet(1))

    @Test
    fun detectsAudioByExtensionOrMimeType() {
        assertTrue(isAudio(file("song.MP3")))
        assertTrue(isAudio(file("voice", "audio/mpeg")))
        assertFalse(isAudio(file("cover.jpg", "image/jpeg")))
        assertFalse(isAudio(folder("music.mp3")))
    }

    @Test
    fun sortsFoldersNaturally() {
        val sorted = sortFolders(listOf(folder("Disc 10"), folder("disc 2"), file("a.mp3"), folder("Disc 1")))
        assertEquals(listOf("Disc 1", "disc 2", "Disc 10"), sorted.map { it.name })
    }

    @Test
    fun sortsTracksByDiscTrackThenName() {
        val sorted = sortTracks(
            listOf(
                file("b.mp3", audio = AudioFacet(disc = 2, track = 1)),
                file("c.mp3", audio = AudioFacet(disc = 1, track = 2)),
                file("a.mp3", audio = AudioFacet(disc = 1, track = 2)),
                file("10.mp3"),
                file("9.mp3"),
                file("cover.jpg"),
            ),
        )
        assertEquals(listOf("9.mp3", "10.mp3", "a.mp3", "c.mp3", "b.mp3"), sorted.map { it.name })
    }

    @Test
    fun buildsTrackFromTagsOrFileName() {
        val tagged = toTrack(file("x.mp3", audio = AudioFacet(title = " Title ", albumArtist = "Band", duration = 61000)))
        assertEquals("Title", tagged.title)
        assertEquals("Band", tagged.artist)
        assertEquals(61000L, tagged.durationMs)
        val plain = toTrack(file("01 Intro.mp3"))
        assertEquals("01 Intro", plain.title)
        assertEquals("", plain.artist)
        assertNull(plain.durationMs)
    }

    @Test
    fun formatsTime() {
        assertEquals("0:05", formatTime(5_000))
        assertEquals("1:01:01", formatTime(3_661_000))
        assertEquals("–:––", formatTime(null))
    }

    @Test
    fun parsesGraphPage() {
        val page = json.decodeFromString<DrivePage>(
            """{"value":[{"id":"1","name":"a.mp3","file":{"mimeType":"audio/mpeg"},"audio":{"track":3},"extra":true}],"@odata.nextLink":"next"}""",
        )
        assertEquals("next", page.nextLink)
        assertEquals(3, page.value.single().audio?.track)
    }
}
