package cz.smallhill.player

import android.app.Application
import android.content.Context
import cz.smallhill.player.auth.Accounts
import cz.smallhill.player.library.Library
import cz.smallhill.player.onedrive.Graph

class PlayerApp : Application() {
    val accounts by lazy { Accounts(this) }
    val graph by lazy { Graph(accounts) }
    val library by lazy { Library(this, accounts, graph) }

    companion object {
        fun from(context: Context) = context.applicationContext as PlayerApp
    }
}
