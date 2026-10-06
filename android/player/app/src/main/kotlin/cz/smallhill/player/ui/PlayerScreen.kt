package cz.smallhill.player.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconToggleButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import cz.smallhill.player.R
import cz.smallhill.player.auth.Account
import cz.smallhill.player.onedrive.formatTime
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(viewModel: LibraryViewModel, onSignIn: (Account?) -> Unit) {
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val stack = viewModel.stack
    var menu by remember { mutableStateOf(false) }

    BackHandler(enabled = stack.isNotEmpty()) { viewModel.back() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stack.lastOrNull()?.title ?: stringResource(R.string.library),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    if (stack.isNotEmpty()) {
                        IconButton(onClick = viewModel::back) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                        }
                    }
                },
                actions = {
                    if (stack.isNotEmpty()) {
                        IconButton(onClick = { menu = true }) {
                            Icon(Icons.Default.MoreVert, stringResource(R.string.more))
                        }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.refresh)) },
                                onClick = { menu = false; viewModel.load(fresh = true) },
                            )
                            if (stack.size > 1) {
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.use_as_top)) },
                                    onClick = { menu = false; viewModel.useAsTop() },
                                )
                            }
                        }
                    }
                },
            )
        },
        bottomBar = {
            if (viewModel.playback.item != null) NowPlaying(viewModel)
        },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            if (stack.isEmpty()) {
                Home(accounts, viewModel, onSignIn)
            } else {
                FolderContent(viewModel, onSignIn)
            }
        }
    }
}

@Composable
private fun Home(accounts: List<Account>, viewModel: LibraryViewModel, onSignIn: (Account?) -> Unit) {
    var removing by remember { mutableStateOf<Account?>(null) }
    LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
        if (accounts.isEmpty()) {
            item {
                Text(
                    stringResource(R.string.intro),
                    Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
        items(accounts, key = { it.id }) { account ->
            var menu by remember { mutableStateOf(false) }
            ListItem(
                modifier = Modifier.clickable {
                    if (account.needsSignIn) onSignIn(account) else viewModel.openAccount(account)
                },
                leadingContent = { Icon(Icons.Default.Cloud, null) },
                headlineContent = { Text(stringResource(R.string.onedrive)) },
                supportingContent = {
                    val top = account.top.joinToString(" / ") { it.name }
                    Text(listOf(account.username, top).filter { it.isNotEmpty() }.joinToString(" · "))
                },
                trailingContent = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (account.needsSignIn) {
                            TextButton(onClick = { onSignIn(account) }) { Text(stringResource(R.string.sign_in_again)) }
                        }
                        Box {
                            IconButton(onClick = { menu = true }) {
                                Icon(Icons.Default.MoreVert, stringResource(R.string.more))
                            }
                            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                                if (account.top.isNotEmpty()) {
                                    DropdownMenuItem(
                                        text = { Text(stringResource(R.string.reset_top)) },
                                        onClick = { menu = false; viewModel.resetTop(account) },
                                    )
                                }
                                DropdownMenuItem(
                                    text = { Text(stringResource(R.string.remove)) },
                                    onClick = { menu = false; removing = account },
                                )
                            }
                        }
                    }
                },
            )
        }
        item {
            Button(onClick = { onSignIn(null) }, Modifier.padding(16.dp)) {
                Icon(Icons.Default.Add, null)
                Text(stringResource(R.string.add_onedrive), Modifier.padding(start = 8.dp))
            }
        }
        item {
            Text(
                stringResource(R.string.privacy),
                Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
    removing?.let { account ->
        AlertDialog(
            onDismissRequest = { removing = null },
            text = { Text(stringResource(R.string.remove_confirm, account.username)) },
            confirmButton = {
                TextButton(onClick = { viewModel.remove(account); removing = null }) { Text(stringResource(R.string.remove)) }
            },
            dismissButton = {
                TextButton(onClick = { removing = null }) { Text(stringResource(R.string.cancel)) }
            },
        )
    }
}

@Composable
private fun FolderContent(viewModel: LibraryViewModel, onSignIn: (Account?) -> Unit) {
    when (val content = viewModel.content) {
        Content.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        is Content.Failed -> Column(
            Modifier.fillMaxSize().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(stringResource(if (content.signInExpired) R.string.sign_in_expired else R.string.folder_error))
            Button(
                onClick = { if (content.signInExpired) onSignIn(viewModel.currentAccount) else viewModel.load(fresh = true) },
                Modifier.padding(top = 16.dp),
            ) {
                Text(stringResource(if (content.signInExpired) R.string.sign_in_again else R.string.retry))
            }
        }
        is Content.Items -> {
            val tracks = content.items.filter { it.mediaMetadata.isPlayable == true }
            val current = viewModel.playback.item?.mediaId
            LazyColumn(Modifier.fillMaxSize()) {
                if (content.items.isEmpty()) {
                    item { Text(stringResource(R.string.empty), Modifier.padding(16.dp)) }
                }
                if (tracks.isNotEmpty()) {
                    item {
                        Row(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilledTonalButton(onClick = { viewModel.playAll(tracks, shuffle = false) }) {
                                Icon(Icons.Default.PlayArrow, null)
                                Text(stringResource(R.string.play_all), Modifier.padding(start = 8.dp))
                            }
                            OutlinedButton(onClick = { viewModel.playAll(tracks, shuffle = true) }) {
                                Icon(Icons.Default.Shuffle, null)
                                Text(stringResource(R.string.shuffle_all), Modifier.padding(start = 8.dp))
                            }
                        }
                    }
                }
                items(content.items, key = { it.mediaId }) { item ->
                    if (item.mediaMetadata.isPlayable == true) {
                        TrackRow(item, playing = item.mediaId == current) { viewModel.play(item) }
                    } else {
                        ListItem(
                            modifier = Modifier.clickable { viewModel.open(item) },
                            leadingContent = { Icon(Icons.Default.Folder, null) },
                            headlineContent = { Text(item.mediaMetadata.title?.toString() ?: "") },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackRow(item: MediaItem, playing: Boolean, onClick: () -> Unit) {
    val metadata = item.mediaMetadata
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        colors = if (playing) ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.secondaryContainer) else ListItemDefaults.colors(),
        leadingContent = {
            Icon(if (playing) Icons.AutoMirrored.Filled.VolumeUp else Icons.Default.MusicNote, null)
        },
        headlineContent = { Text(metadata.title?.toString() ?: "", maxLines = 2, overflow = TextOverflow.Ellipsis) },
        supportingContent = metadata.artist?.let { { Text(it.toString(), maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        trailingContent = metadata.durationMs?.let { { Text(formatTime(it)) } },
    )
}

@Composable
private fun NowPlaying(viewModel: LibraryViewModel) {
    val playback = viewModel.playback
    val browser = viewModel.browser ?: return
    val metadata = playback.item?.mediaMetadata ?: return
    var position by remember { mutableFloatStateOf(0f) }
    var seeking by remember { mutableStateOf(false) }
    LaunchedEffect(playback.item, playback.isPlaying) {
        while (true) {
            if (!seeking) position = browser.currentPosition.toFloat()
            delay(500)
        }
    }
    val duration = playback.durationMs?.toFloat()?.coerceAtLeast(1f)
    Surface(tonalElevation = 3.dp) {
        Column(Modifier.navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(metadata.title?.toString() ?: "", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                    metadata.artist?.let {
                        Text(it.toString(), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Text(
                    "${formatTime(position.toLong())} / ${formatTime(playback.durationMs)}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (duration != null) {
                Slider(
                    value = position.coerceIn(0f, duration),
                    valueRange = 0f..duration,
                    onValueChange = { seeking = true; position = it },
                    onValueChangeFinished = { browser.seekTo(position.toLong()); seeking = false },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                IconToggleButton(checked = playback.shuffle, onCheckedChange = { browser.shuffleModeEnabled = it }) {
                    Icon(Icons.Default.Shuffle, stringResource(R.string.shuffle))
                }
                IconButton(onClick = { browser.seekToPrevious() }, enabled = playback.hasPrevious) {
                    Icon(Icons.Default.SkipPrevious, stringResource(R.string.previous))
                }
                IconButton(onClick = { if (playback.isPlaying) browser.pause() else browser.play() }) {
                    Icon(
                        if (playback.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        stringResource(if (playback.isPlaying) R.string.pause else R.string.play),
                    )
                }
                IconButton(onClick = { browser.seekToNext() }, enabled = playback.hasNext) {
                    Icon(Icons.Default.SkipNext, stringResource(R.string.next))
                }
                IconToggleButton(
                    checked = playback.repeatMode != Player.REPEAT_MODE_OFF,
                    onCheckedChange = {
                        browser.repeatMode = when (playback.repeatMode) {
                            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ALL
                            Player.REPEAT_MODE_ALL -> Player.REPEAT_MODE_ONE
                            else -> Player.REPEAT_MODE_OFF
                        }
                    },
                ) {
                    Icon(
                        if (playback.repeatMode == Player.REPEAT_MODE_ONE) Icons.Default.RepeatOne else Icons.Default.Repeat,
                        stringResource(
                            when (playback.repeatMode) {
                                Player.REPEAT_MODE_ALL -> R.string.repeat_all
                                Player.REPEAT_MODE_ONE -> R.string.repeat_one
                                else -> R.string.repeat_off
                            },
                        ),
                    )
                }
            }
        }
    }
}
