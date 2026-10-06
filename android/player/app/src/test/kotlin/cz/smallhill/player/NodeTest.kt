package cz.smallhill.player

import cz.smallhill.player.library.Node
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NodeTest {
    @Test
    fun roundTripsIds() {
        listOf(
            Node.Root,
            Node.Account("abc"),
            Node.Folder("abc", "F00!123"),
            Node.Track("abc", "root", "01ABC!45"),
        ).forEach { assertEquals(it, Node.parse(it.id)) }
    }

    @Test
    fun rejectsUnknownIds() {
        assertNull(Node.parse("x/1"))
        assertNull(Node.parse("f/only"))
    }
}
