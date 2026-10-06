package cz.smallhill.player.playback

import android.app.PendingIntent
import android.content.Intent
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.SessionError
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.ListenableFuture
import cz.smallhill.player.PlayerApp
import java.util.concurrent.ConcurrentHashMap
import cz.smallhill.player.auth.SignInExpired
import cz.smallhill.player.library.Library
import cz.smallhill.player.library.Node
import cz.smallhill.player.ui.MainActivity
import androidx.core.net.toUri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.guava.future
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
class PlaybackService : MediaLibraryService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var library: Library
    private lateinit var queue: QueueStore
    private lateinit var player: ExoPlayer
    private lateinit var session: MediaLibrarySession
    private val searches = ConcurrentHashMap<String, List<MediaItem>>()

    override fun onCreate() {
        super.onCreate()
        val app = PlayerApp.from(this)
        library = app.library
        queue = QueueStore(this)

        val resolver = ResolvingDataSource.Resolver { spec: DataSpec ->
            if (spec.uri.scheme != Library.SCHEME) return@Resolver spec
            val accountId = spec.uri.authority ?: return@Resolver spec
            val itemId = spec.uri.lastPathSegment ?: return@Resolver spec
            spec.withUri(app.graph.downloadUrl(accountId, itemId).toUri())
        }
        val upstream = DefaultDataSource.Factory(
            this,
            DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true),
        )
        player = ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(ResolvingDataSource.Factory(upstream, resolver)))
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),
                true,
            )
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        player.addListener(listener)

        val activity = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        session = MediaLibrarySession.Builder(this, player, callback).setSessionActivity(activity).build()

        queue.load()?.let { saved ->
            player.setMediaItems(saved.items.mapNotNull { library.playable(it.toMediaItem()) }, saved.index, saved.positionMs)
            player.prepare()
        }

        scope.launch {
            app.accounts.list.drop(1).collect {
                session.notifyChildrenChanged(Node.Root.id, it.size, null)
            }
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo) = session

    override fun onDestroy() {
        save()
        scope.cancel()
        session.release()
        player.release()
        super.onDestroy()
    }

    private fun save() {
        if (player.mediaItemCount == 0) return queue.save(null)
        val items = (0 until player.mediaItemCount).map { player.getMediaItemAt(it).toSaved() }
        queue.save(SavedQueue(items, player.currentMediaItemIndex, player.currentPosition))
    }

    private val listener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = save()

        override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
            if (reason == Player.TIMELINE_CHANGE_REASON_PLAYLIST_CHANGED) save()
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            if (!isPlaying) save()
        }

        override fun onPlayerError(error: PlaybackException) {
            if (player.hasNextMediaItem()) {
                player.seekToNextMediaItem()
                player.prepare()
                player.play()
            }
        }
    }

    private fun <T> io(block: suspend CoroutineScope.() -> T): ListenableFuture<T> = scope.future(Dispatchers.IO, block = block)

    private val callback = object : MediaLibrarySession.Callback {
        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<MediaItem>> =
            io { LibraryResult.ofItem(library.root, params) }

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = io {
            try {
                val fresh = params?.extras?.getBoolean(EXTRA_FRESH) == true
                val children = library.children(parentId, fresh)
                    ?: return@io LibraryResult.ofError(SessionError.ERROR_BAD_VALUE)
                val from = (page * pageSize).coerceAtMost(children.size)
                val to = (from.toLong() + pageSize).coerceAtMost(children.size.toLong()).toInt()
                LibraryResult.ofItemList(children.subList(from, to), params)
            } catch (error: SignInExpired) {
                LibraryResult.ofError(SessionError.ERROR_SESSION_AUTHENTICATION_EXPIRED)
            } catch (error: Exception) {
                LibraryResult.ofError(SessionError.ERROR_IO)
            }
        }

        override fun onGetItem(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            mediaId: String,
        ): ListenableFuture<LibraryResult<MediaItem>> = io {
            try {
                library.item(mediaId)?.let { LibraryResult.ofItem(it, null) }
                    ?: LibraryResult.ofError(SessionError.ERROR_BAD_VALUE)
            } catch (error: Exception) {
                LibraryResult.ofError(SessionError.ERROR_IO)
            }
        }

        override fun onSearch(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<Void>> = io {
            val results = library.search(query)
            searches[query] = results
            session.notifySearchResultChanged(browser, query, results.size, params)
            LibraryResult.ofVoid()
        }

        override fun onGetSearchResult(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            query: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?,
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = io {
            val results = searches[query] ?: library.search(query).also { searches[query] = it }
            val from = (page * pageSize).coerceAtMost(results.size)
            val to = (from.toLong() + pageSize).coerceAtMost(results.size.toLong()).toInt()
            LibraryResult.ofItemList(results.subList(from, to), params)
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
        ): ListenableFuture<List<MediaItem>> = io { mediaItems.mapNotNull(library::playable) }

        override fun onSetMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
            startIndex: Int,
            startPositionMs: Long,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> = io {
            val query = mediaItems.singleOrNull()?.takeIf { it.mediaId.isEmpty() }?.requestMetadata?.searchQuery
            if (query != null) {
                val saved = queue.load()
                if (query.isBlank() && saved != null) {
                    return@io MediaSession.MediaItemsWithStartPosition(
                        saved.items.mapNotNull { library.playable(it.toMediaItem()) },
                        saved.index,
                        saved.positionMs,
                    )
                }
                return@io MediaSession.MediaItemsWithStartPosition(library.search(query), 0, 0)
            }
            val single = mediaItems.singleOrNull()?.let { Node.parse(it.mediaId) as? Node.Track }
            if (single != null) {
                val tracks = runCatching { library.folderTracks(single) }.getOrDefault(emptyList())
                val index = tracks.indexOfFirst { it.mediaId == single.id }
                if (index >= 0) return@io MediaSession.MediaItemsWithStartPosition(tracks, index, startPositionMs)
            }
            MediaSession.MediaItemsWithStartPosition(mediaItems.mapNotNull(library::playable), startIndex, startPositionMs)
        }

        override fun onPlaybackResumption(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            isForPlayback: Boolean,
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> = io {
            val saved = queue.load() ?: throw UnsupportedOperationException()
            MediaSession.MediaItemsWithStartPosition(
                saved.items.mapNotNull { library.playable(it.toMediaItem()) },
                saved.index,
                saved.positionMs,
            )
        }
    }

    companion object {
        const val EXTRA_FRESH = "cz.smallhill.player.FRESH"
    }
}
