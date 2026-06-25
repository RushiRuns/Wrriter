package com.rushi.wrriter

import org.junit.Assert.*
import org.junit.Test

class BreakReminderTest {

    @Test
    fun testGapCalculation_ContinuousTyping() {
        var sessionStartTime = 1000L
        var lastKeyPressTime = 1000L
        
        // Keypress after 1 minute (60,000 ms)
        val now1 = 61000L
        val gap1 = now1 - lastKeyPressTime
        val isGapExceeded = gap1 > 2 * 60 * 1000L
        
        assertFalse(isGapExceeded)
        
        if (!isGapExceeded) {
            // Keep same sessionStartTime
        } else {
            sessionStartTime = now1
        }
        lastKeyPressTime = now1
        
        assertEquals(1000L, sessionStartTime)
        assertEquals(61000L, lastKeyPressTime)
    }

    @Test
    fun testGapCalculation_IdleReset() {
        var sessionStartTime = 1000L
        var lastKeyPressTime = 1000L
        
        // Keypress after 3 minutes (180,000 ms) - exceeds 2-minute gap
        val now1 = 181000L
        val gap1 = now1 - lastKeyPressTime
        val isGapExceeded = gap1 > 2 * 60 * 1000L
        
        assertTrue(isGapExceeded)
        
        if (isGapExceeded) {
            sessionStartTime = now1
        }
        lastKeyPressTime = now1
        
        assertEquals(181000L, sessionStartTime)
        assertEquals(181000L, lastKeyPressTime)
    }

    @Test
    fun testReminderThreshold() {
        val sessionStartTime = 1000L
        val thresholdMinutes = 60
        val thresholdMs = thresholdMinutes * 60 * 1000L
        
        // After 61 minutes
        val now = 1000L + 61 * 60 * 1000L
        val elapsed = now - sessionStartTime
        
        assertTrue(elapsed >= thresholdMs)
    }
}
