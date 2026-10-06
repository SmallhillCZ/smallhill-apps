package cz.smallhill.player

object Config {
    const val CLIENT_ID = "a3e7e477-7aba-4c4b-a605-726a61e06edc"
    const val AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0"
    const val SCOPES = "openid profile offline_access Files.Read"
    const val REDIRECT_URI = "cz.smallhill.player://auth"
    const val GRAPH = "https://graph.microsoft.com/v1.0"
}
