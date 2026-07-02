package com.rushi.wrriter.data

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

// Datastore extension for context
val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "wrriter_settings")

class PreferencesManager(private val context: Context) {

    companion object {
        private val VAULT_URI_KEY = stringPreferencesKey("vault_uri")
        private val THEME_KEY = stringPreferencesKey("theme")
        private val FONT_KEY = stringPreferencesKey("font")
        private val TEXTURE_KEY = stringPreferencesKey("texture")
        private val SPELLCHECK_KEY = booleanPreferencesKey("spellcheck")
        private val TAB_MODE_KEY = stringPreferencesKey("tab_mode")
        private val BREAK_REMINDER_ENABLED_KEY = booleanPreferencesKey("break_reminder_enabled")
        private val BREAK_REMINDER_THRESHOLD_KEY = intPreferencesKey("break_reminder_threshold")
        private val SYNCTHING_IP_KEY = stringPreferencesKey("syncthing_ip")
        private val SYNCTHING_PORT_KEY = intPreferencesKey("syncthing_port")
        private val LAST_USED_FOLDER_KEY = stringPreferencesKey("last_used_folder")

        private const val SECURE_PREFS_NAME = "wrriter_secure_prefs"
        private const val KEY_SYNCTHING_API_KEY = "syncthing_api_key"
    }

    // Secure EncryptedSharedPreferences initialization
    private val securePrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            SECURE_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    // --- Vault URI (SAF Path) ---
    val vaultUriFlow: Flow<String?> = context.settingsDataStore.data.map { preferences ->
        preferences[VAULT_URI_KEY]
    }

    suspend fun saveVaultUri(uriString: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[VAULT_URI_KEY] = uriString
        }
    }

    // --- Last Used Folder ---
    val lastUsedFolderFlow: Flow<String> = context.settingsDataStore.data.map { preferences ->
        preferences[LAST_USED_FOLDER_KEY] ?: "Inbox"
    }

    suspend fun saveLastUsedFolder(folderName: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[LAST_USED_FOLDER_KEY] = folderName
        }
    }

    // --- UI Preferences ---
    val themeFlow: Flow<String> = context.settingsDataStore.data.map { preferences ->
        preferences[THEME_KEY] ?: "oled" // OLED black is default
    }

    suspend fun saveTheme(theme: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[THEME_KEY] = theme
        }
    }

    val fontFlow: Flow<String> = context.settingsDataStore.data.map { preferences ->
        preferences[FONT_KEY] ?: "default"
    }

    suspend fun saveFont(fontName: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[FONT_KEY] = fontName
        }
    }

    val textureFlow: Flow<String> = context.settingsDataStore.data.map { preferences ->
        preferences[TEXTURE_KEY] ?: "none" // ruled, grid, paper, none
    }

    suspend fun saveTexture(textureName: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[TEXTURE_KEY] = textureName
        }
    }

    val spellcheckFlow: Flow<Boolean> = context.settingsDataStore.data.map { preferences ->
        preferences[SPELLCHECK_KEY] ?: true
    }

    suspend fun saveSpellcheck(enabled: Boolean) {
        context.settingsDataStore.edit { preferences ->
            preferences[SPELLCHECK_KEY] = enabled
        }
    }

    val tabModeFlow: Flow<String> = context.settingsDataStore.data.map { preferences ->
        preferences[TAB_MODE_KEY] ?: "2spaces" // tab, 2spaces, 4spaces
    }

    suspend fun saveTabMode(tabMode: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[TAB_MODE_KEY] = tabMode
        }
    }

    // --- Break Reminders ---
    val breakReminderEnabledFlow: Flow<Boolean> = context.settingsDataStore.data.map { preferences ->
        preferences[BREAK_REMINDER_ENABLED_KEY] ?: true
    }

    suspend fun saveBreakReminderEnabled(enabled: Boolean) {
        context.settingsDataStore.edit { preferences ->
            preferences[BREAK_REMINDER_ENABLED_KEY] = enabled
        }
    }

    val breakReminderThresholdFlow: Flow<Int> = context.settingsDataStore.data.map { preferences ->
        preferences[BREAK_REMINDER_THRESHOLD_KEY] ?: 60 // 60 minutes default
    }

    suspend fun saveBreakReminderThreshold(minutes: Int) {
        context.settingsDataStore.edit { preferences ->
            preferences[BREAK_REMINDER_THRESHOLD_KEY] = minutes
        }
    }

    // --- Syncthing IP and Port ---
    val syncthingIpFlow: Flow<String> = context.settingsDataStore.data.map { preferences ->
        preferences[SYNCTHING_IP_KEY] ?: "http://192.168.1.100"
    }

    suspend fun saveSyncthingIp(ip: String) {
        context.settingsDataStore.edit { preferences ->
            preferences[SYNCTHING_IP_KEY] = ip
        }
    }

    val syncthingPortFlow: Flow<Int> = context.settingsDataStore.data.map { preferences ->
        preferences[SYNCTHING_PORT_KEY] ?: 8384
    }

    suspend fun saveSyncthingPort(port: Int) {
        context.settingsDataStore.edit { preferences ->
            preferences[SYNCTHING_PORT_KEY] = port
        }
    }

    // --- Secure Syncthing API Key ---
    fun saveSyncthingApiKey(apiKey: String) {
        securePrefs.edit().putString(KEY_SYNCTHING_API_KEY, apiKey).apply()
    }

    fun getSyncthingApiKey(): String {
        return securePrefs.getString(KEY_SYNCTHING_API_KEY, "") ?: ""
    }
}
