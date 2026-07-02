package com.rushi.wrriter.network

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class SyncthingClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()

    private fun buildBaseUrl(ip: String, port: Int): String {
        val cleanIp = ip.trim()
        val prefix = if (!cleanIp.startsWith("http://") && !cleanIp.startsWith("https://")) {
            "http://"
        } else {
            ""
        }
        return "$prefix$cleanIp:$port"
    }

    /**
     * Fetches system status from `/rest/system/status`.
     * Returns system status details, or null if error.
     */
    fun getSystemStatus(ip: String, port: Int, apiKey: String): SyncthingStatus? {
        val baseUrl = buildBaseUrl(ip, port)
        val url = "$baseUrl/rest/system/status"
        val request = Request.Builder()
            .url(url)
            .addHeader("X-API-Key", apiKey)
            .addHeader("Accept", "application/json")
            .get()
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val bodyStr = response.body?.string() ?: return null
                val json = JSONObject(bodyStr)
                SyncthingStatus(
                    uptime = json.optLong("uptime", 0),
                    myID = json.optString("myID", "Unknown"),
                    status = json.optString("status", "unknown")
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Lists registered sync client devices from `/rest/config/devices`.
     */
    fun getDevices(ip: String, port: Int, apiKey: String): List<SyncthingDevice> {
        val devices = mutableListOf<SyncthingDevice>()
        val baseUrl = buildBaseUrl(ip, port)
        val url = "$baseUrl/rest/config/devices"
        val request = Request.Builder()
            .url(url)
            .addHeader("X-API-Key", apiKey)
            .addHeader("Accept", "application/json")
            .get()
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return emptyList()
                val bodyStr = response.body?.string() ?: return emptyList()
                val jsonArray = JSONArray(bodyStr)
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    devices.add(
                        SyncthingDevice(
                            deviceID = obj.optString("deviceID", ""),
                            name = obj.optString("name", "Unnamed Device"),
                            connected = obj.optBoolean("connected", false),
                            paused = obj.optBoolean("paused", false)
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return devices
    }

    /**
     * Sends database scan request for a folder ID to `/rest/db/scan`.
     */
    fun triggerScan(ip: String, port: Int, apiKey: String, folderId: String = "default"): Boolean {
        val baseUrl = buildBaseUrl(ip, port)
        val url = "$baseUrl/rest/db/scan?folder=$folderId"
        val request = Request.Builder()
            .url(url)
            .addHeader("X-API-Key", apiKey)
            .addHeader("Accept", "application/json")
            .post("".toRequestBody())
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}

data class SyncthingStatus(
    val uptime: Long,
    val myID: String,
    val status: String
)

data class SyncthingDevice(
    val deviceID: String,
    val name: String,
    val connected: Boolean,
    val paused: Boolean
)
