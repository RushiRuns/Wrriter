package com.rushi.wrriter

import android.content.Context
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.VaultManager
import io.mockk.mockk
import org.junit.Assert.*
import org.junit.Test

class FrontmatterParserTest {

    private val mockContext = mockk<Context>(relaxed = true)
    private val vaultManager = VaultManager(mockContext)

    @Test
    fun testParseFrontmatter_SimpleKeyValue() {
        val rawContent = """
            ---
            title: "Test Note"
            tags: ["test", "writing"]
            created: "2026-06-25T14:00:00+05:30"
            modified: "2026-06-25T14:30:00+05:30"
            inbox: true
            ---
            Hello world! This is my note content.
        """.trimIndent()

        val (metadataMap, body) = vaultManager.parseFrontmatter(rawContent)

        assertEquals("Test Note", metadataMap["title"])
        assertEquals(listOf("test", "writing"), metadataMap["tags"])
        assertEquals("2026-06-25T14:00:00+05:30", metadataMap["created"])
        assertEquals("2026-06-25T14:30:00+05:30", metadataMap["modified"])
        assertEquals(true, metadataMap["inbox"])
        assertEquals("Hello world! This is my note content.", body.trim())
    }

    @Test
    fun testParseFrontmatter_BulletListTags() {
        val rawContent = """
            ---
            title: "List Tags Note"
            tags:
              - "bullet1"
              - "bullet2"
            inbox: false
            ---
            Body goes here.
        """.trimIndent()

        val (metadataMap, body) = vaultManager.parseFrontmatter(rawContent)

        assertEquals("List Tags Note", metadataMap["title"])
        assertEquals(listOf("bullet1", "bullet2"), metadataMap["tags"])
        assertEquals(false, metadataMap["inbox"])
        assertEquals("Body goes here.", body.trim())
    }

    @Test
    fun testSerializeFrontmatter() {
        val metadata = NoteMetadata(
            uriString = "content://dummy",
            filePath = "Inbox",
            fileName = "test.md",
            title = "Serialized Title",
            tags = listOf("tag1", "tag2"),
            createdTime = 1782358800000L,
            modifiedTime = 1782377670000L,
            isInbox = true,
            wordCount = 5
        )
        val body = "This is a serialized body."

        val serialized = vaultManager.serializeFrontmatter(metadata, body)

        assertTrue(serialized.contains("title: \"Serialized Title\""))
        assertTrue(serialized.contains("  - \"tag1\""))
        assertTrue(serialized.contains("  - \"tag2\""))
        assertTrue(serialized.contains("inbox: true"))
        assertTrue(serialized.contains("This is a serialized body."))
    }
}
