package cz.smallhill.player.library

sealed interface Node {
    val id: String

    data object Root : Node {
        override val id = "root"
    }

    data class Account(val accountId: String) : Node {
        override val id get() = "a/$accountId"
    }

    data class Folder(val accountId: String, val folderId: String) : Node {
        override val id get() = "f/$accountId/$folderId"
    }

    data class Track(val accountId: String, val folderId: String, val itemId: String) : Node {
        override val id get() = "t/$accountId/$folderId/$itemId"
    }

    companion object {
        fun parse(id: String): Node? {
            val parts = id.split('/', limit = 4)
            return when {
                id == Root.id -> Root
                parts[0] == "a" && parts.size == 2 -> Account(parts[1])
                parts[0] == "f" && parts.size == 3 -> Folder(parts[1], parts[2])
                parts[0] == "t" && parts.size == 4 -> Track(parts[1], parts[2], parts[3])
                else -> null
            }
        }
    }
}
