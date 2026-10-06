package cz.smallhill.player.ui

import android.app.Application
import android.content.ComponentName
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaBrowser
import androidx.media3.session.MediaLibraryService.LibraryParams
import androidx.media3.session.SessionError
import androidx.media3.session.SessionToken
import cz.smallhill.player.PlayerApp
import cz.smallhill.player.auth.Account
import cz.smallhill.player.library.Node
import cz.smallhill.player.onedrive.Folder
import cz.smallhill.player.playback.PlaybackService
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.launch

data class Crumb(val id: String, val title: String)

sealed interface Content {
    data object Loading : Content
    data class Items(val items: List<MediaItem>) : Content
    data class Failed(val signInExpired: Boolean) : Content
}

data class Playback(
    val item: MediaItem? = null,
    val isPlaying: Boolean = false,
    val durationMs: Long? = null,
    val hasPrevious: Boolean = false,
    val hasNext: Boolean = false,
    val shuffle: Boolean = false,
    val repeatMode: Int = Player.REPEAT_MODE_OFF,
)

class LibraryViewModel(application: Application) : AndroidViewModel(application) {
    private val app = PlayerApp.from(application)
    val accounts = app.accounts.list

    private val browserFuture = MediaBrowser.Builder(
        application,
        SessionToken(application, ComponentName(application, PlaybackService::class.java)),
    ).buildAsync()

    var browser by mutableStateOf<MediaBrowser?>(null)
        private set
    val stack = mutableStateListOf<Crumb>()
    var content by mutableStateOf<Content>(Content.Loading)
        private set
    var playback by mutableStateOf(Playback())
        private set

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = update(player)
    }

    init {
        viewModelScope.launch {
            val connected = browserFuture.await()
            connected.addListener(listener)
            update(connected)
            browser = connected
            load()
        }
    }

    private fun update(player: Player) {
        playback = Playback(
            item = player.currentMediaItem,
            isPlaying = player.isPlaying,
            durationMs = player.duration.takeIf { it != C.TIME_UNSET }
                ?: player.currentMediaItem?.mediaMetadata?.durationMs,
            hasPrevious = player.mediaItemCount > 0,
            hasNext = player.hasNextMediaItem(),
            shuffle = player.shuffleModeEnabled,
            repeatMode = player.repeatMode,
        )
    }

    val currentAccount: Account?
        get() = stack.firstOrNull()?.let { Node.parse(it.id) as? Node.Account }?.let { app.accounts.get(it.accountId) }

    fun openAccount(account: Account) {
        stack.clear()
        stack += Crumb(Node.Account(account.id).id, account.username.ifEmpty { account.name })
        load()
    }

    fun open(item: MediaItem) {
        stack += Crumb(item.mediaId, item.mediaMetadata.title?.toString() ?: "")
        load()
    }

    fun back() {
        if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex)
        load()
    }

    @OptIn(UnstableApi::class)
    fun load(fresh: Boolean = false) {
        val id = stack.lastOrNull()?.id ?: return
        val connected = browser ?: return
        content = Content.Loading
        val params = LibraryParams.Builder().setExtras(Bundle().apply { putBoolean(PlaybackService.EXTRA_FRESH, fresh) }).build()
        viewModelScope.launch {
            val result = runCatching { connected.getChildren(id, 0, Int.MAX_VALUE, params).await() }.getOrNull()
            if (stack.lastOrNull()?.id != id) return@launch
            content = when {
                result?.resultCode == LibraryResult.RESULT_SUCCESS -> Content.Items(result.value.orEmpty())
                else -> Content.Failed(result?.resultCode == SessionError.ERROR_SESSION_AUTHENTICATION_EXPIRED)
            }
        }
    }

    fun playFromSearch(query: String) {
        viewModelScope.launch {
            val connected = browserFuture.await()
            connected.setMediaItem(
                MediaItem.Builder().setRequestMetadata(MediaItem.RequestMetadata.Builder().setSearchQuery(query).build()).build(),
            )
            connected.prepare()
            connected.play()
        }
    }

    fun play(item: MediaItem) {
        val connected = browser ?: return
        connected.shuffleModeEnabled = false
        connected.setMediaItem(item)
        connected.prepare()
        connected.play()
    }

    fun playAll(tracks: List<MediaItem>, shuffle: Boolean) {
        val connected = browser ?: return
        connected.shuffleModeEnabled = shuffle
        connected.setMediaItems(tracks, if (shuffle) tracks.indices.random() else 0, 0)
        connected.prepare()
        connected.play()
    }

    fun useAsTop() {
        val account = currentAccount ?: return
        val folders = stack.drop(1).mapNotNull { crumb ->
            (Node.parse(crumb.id) as? Node.Folder)?.let { Folder(it.folderId, crumb.title) }
        }
        app.accounts.setTop(account.id, account.top + folders)
        while (stack.size > 1) stack.removeAt(stack.lastIndex)
        load()
    }

    fun resetTop(account: Account) = app.accounts.setTop(account.id, emptyList())

    fun remove(account: Account) = app.accounts.remove(account.id)

    override fun onCleared() {
        browser?.removeListener(listener)
        MediaBrowser.releaseFuture(browserFuture)
    }
}
