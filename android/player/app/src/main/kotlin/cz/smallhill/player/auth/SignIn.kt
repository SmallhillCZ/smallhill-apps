package cz.smallhill.player.auth

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import androidx.lifecycle.lifecycleScope
import cz.smallhill.player.PlayerApp
import cz.smallhill.player.R
import cz.smallhill.player.ui.MainActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

object SignIn {
    fun start(activity: Activity, loginHint: String? = null) {
        val pending = PendingSignIn(OAuth.randomToken(), OAuth.randomToken())
        PlayerApp.from(activity).accounts.pending = pending
        val url = OAuth.authorizeUrl(pending.state, pending.verifier, loginHint)
        CustomTabsIntent.Builder().build().launchUrl(activity, url.toUri())
    }
}

class RedirectActivity : androidx.activity.ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val accounts = PlayerApp.from(this).accounts
        val uri = intent.data
        val pending = accounts.pending
        val code = uri?.getQueryParameter("code")
        if (pending == null || code == null || uri.getQueryParameter("state") != pending.state) {
            if (uri?.getQueryParameter("error") != "access_denied") failed()
            return done()
        }
        accounts.pending = null
        lifecycleScope.launch {
            try {
                val tokens = withContext(Dispatchers.IO) { OAuth.redeem(code, pending.verifier) }
                accounts.signedIn(tokens)
            } catch (error: Exception) {
                failed()
            }
            done()
        }
    }

    private fun failed() {
        Toast.makeText(this, R.string.sign_in_failed, Toast.LENGTH_LONG).show()
    }

    private fun done() {
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        finish()
    }
}
