package com.rushi.wrriter.sensor

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

/**
 * Robust sensor listener detecting physical device shakes with configurable thresholds and debouncing.
 */
class ShakeDetector(private val onShake: () -> Unit) : SensorEventListener {

    // Threshold force to register a shake (m/s^2)
    private val shakeThresholdGravity = 2.7f
    private val shakeSlopTimeMs = 500
    private val shakeCountResetTimeMs = 3000

    private var mSensorX = 0f
    private var mSensorY = 0f
    private var mSensorZ = 0f

    private var mShakeTime: Long = 0
    private var mShakeCount = 0

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Not used
    }

    override fun onSensorChanged(event: SensorEvent) {
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        // Calculate gravity force
        val gX = x / SensorManager.GRAVITY_EARTH
        val gY = y / SensorManager.GRAVITY_EARTH
        val gZ = z / SensorManager.GRAVITY_EARTH

        // gForce will be close to 1 when there is no movement
        val gForce = sqrt(gX * gX + gY * gY + gZ * gZ)

        if (gForce > shakeThresholdGravity) {
            val now = System.currentTimeMillis()
            
            // Ignore shake events too close to each other
            if (mShakeTime + shakeSlopTimeMs > now) {
                return
            }

            // Reset the shake count if the last shake was too long ago
            if (mShakeTime + shakeCountResetTimeMs < now) {
                mShakeCount = 0
            }

            mShakeTime = now
            mShakeCount++

            // Trigger shake callback after 2 continuous shakes
            if (mShakeCount >= 2) {
                onShake()
                mShakeCount = 0 // Reset
            }
        }
    }
}
