package com.rushi.wrriter

import android.content.Context
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.VaultManager
import io.mockk.mockk
import org.junit.Assert.*
import org.junit.Test

class VaultManagerTest {

    private val mockContext = mockk<Context>(relaxed = true)
    private val vaultManager = VaultManager(mockContext)

    @Test
    fun testGetCachedNotes_Empty() {
        val notes = vaultManager.getCachedNotes()
        assertTrue(notes.isEmpty())
    }

    @Test
    fun testGetCachedNotes_WithItems() {
        // Access private noteCache map via reflection to inject mock metadata
        val cacheField = VaultManager::class.java.getDeclaredField("noteCache")
        cacheField.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        val cache = cacheField.get(vaultManager) as MutableMap<String, NoteMetadata>

        val note1 = NoteMetadata("content://1", "Inbox", "note1.md", "Note 1", emptyList(), 0L, 0L, true, 10)
        val note2 = NoteMetadata("content://2", "Later", "note2.md", "Note 2", emptyList(), 0L, 0L, false, 20)

        cache["content://1"] = note1
        cache["content://2"] = note2

        val cachedList = vaultManager.getCachedNotes()
        assertEquals(2, cachedList.size)
        assertTrue(cachedList.contains(note1))
        assertTrue(cachedList.contains(note2))
    }

    @Test
    fun testGetInboxNotes() {
        val cacheField = VaultManager::class.java.getDeclaredField("noteCache")
        cacheField.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        val cache = cacheField.get(vaultManager) as MutableMap<String, NoteMetadata>

        val note1 = NoteMetadata("content://1", "Inbox", "note1.md", "Note 1", emptyList(), 0L, 0L, true, 10)
        val note2 = NoteMetadata("content://2", "Later", "note2.md", "Note 2", emptyList(), 0L, 0L, false, 20)

        cache["content://1"] = note1
        cache["content://2"] = note2

        val inboxNotes = vaultManager.getInboxNotes()
        assertEquals(1, inboxNotes.size)
        assertEquals(note1, inboxNotes[0])
    }
}
