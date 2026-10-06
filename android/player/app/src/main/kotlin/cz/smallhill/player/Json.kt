package cz.smallhill.player

import kotlinx.serialization.json.Json

val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}
