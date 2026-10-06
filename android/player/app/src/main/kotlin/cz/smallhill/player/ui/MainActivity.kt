package cz.smallhill.player.ui

import android.app.SearchManager
import android.content.Intent
import android.os.Bundle
import android.provider.MediaStore
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import cz.smallhill.player.auth.SignIn

class MainActivity : ComponentActivity() {
    private val viewModel: LibraryViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) handle(intent)
        setContent {
            PlayerTheme {
                PlayerScreen(
                    viewModel = viewModel,
                    onSignIn = { account -> SignIn.start(this, account?.username) },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent) {
        if (intent.action == MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH) {
            viewModel.playFromSearch(intent.getStringExtra(SearchManager.QUERY).orEmpty())
        }
    }

    override fun onResume() {
        super.onResume()
        if (viewModel.content is Content.Failed) viewModel.load()
    }
}
