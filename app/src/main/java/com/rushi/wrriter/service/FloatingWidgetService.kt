package com.rushi.wrriter.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.DocumentsContract
import android.text.InputType
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import androidx.documentfile.provider.DocumentFile
import com.rushi.wrriter.data.AudioRecorder
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.data.VaultManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class FloatingWidgetService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private lateinit var preferencesManager: PreferencesManager
    private lateinit var vaultManager: VaultManager
    private lateinit var audioRecorder: AudioRecorder
    private lateinit var tempAudioFile: File

    private var windowManager: WindowManager? = null
    
    // View references
    private var floatingButton: FrameLayout? = null
    private var menuCard: LinearLayout? = null
    private var quickWriteDialog: LinearLayout? = null
    private var voiceRecorderDialog: LinearLayout? = null

    // WindowManager Layout Params
    private lateinit var buttonParams: WindowManager.LayoutParams
    private lateinit var overlayParams: WindowManager.LayoutParams

    // Audio recording state
    private var recordHandler: Handler? = null
    private var recordSeconds = 0
    private var isRecording = false

    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val NOTIFICATION_ID = 1002
        private const val CHANNEL_ID = "floating_widget_channel"
        var isServiceRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true
        preferencesManager = PreferencesManager(applicationContext)
        vaultManager = VaultManager(applicationContext)
        audioRecorder = AudioRecorder(applicationContext)
        tempAudioFile = File(cacheDir, "temp_overlay_voice.m4a")

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        createNotificationChannel()
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Wrriter Assistive Touch Active")
            .setContentText("Tap the floating pencil icon for quick capture actions")
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        setupParams()
        createFloatingButton()
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        serviceScope.cancel()
        removeViewSafely(floatingButton)
        removeViewSafely(menuCard)
        removeViewSafely(quickWriteDialog)
        removeViewSafely(voiceRecorderDialog)
        stopRecordingTimer()
        if (isRecording) {
            try {
                audioRecorder.stop()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Assistive Touch Floating Menu",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun setupParams() {
        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        buttonParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 300
        }

        overlayParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT
        ).apply {
            dimAmount = 0.5f
            gravity = Gravity.CENTER
        }
    }

    private fun createFloatingButton() {
        val scale = resources.displayMetrics.density
        floatingButton = FrameLayout(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xFF94A3B8.toInt()) // Brand Slate Grey
            }
            val padding = (12 * scale).toInt()
            setPadding(padding, padding, padding, padding)

            val icon = ImageView(context).apply {
                setImageResource(android.R.drawable.ic_menu_edit)
                setColorFilter(Color.BLACK)
            }
            addView(icon, FrameLayout.LayoutParams(
                (24 * scale).toInt(),
                (24 * scale).toInt(),
                Gravity.CENTER
            ))
        }

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isMoving = false

        floatingButton?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = buttonParams.x
                    initialY = buttonParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isMoving = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()

                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                        isMoving = true
                    }

                    buttonParams.x = initialX + deltaX
                    buttonParams.y = initialY + deltaY
                    windowManager?.updateViewLayout(floatingButton, buttonParams)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isMoving) {
                        showMenuCard()
                    }
                    true
                }
                else -> false
            }
        }

        windowManager?.addView(floatingButton, buttonParams)
    }

    private fun showMenuCard() {
        if (menuCard != null) return
        removeViewSafely(floatingButton)

        val scale = resources.displayMetrics.density
        menuCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = createCardBackground()
            val pad = (20 * scale).toInt()
            setPadding(pad, pad, pad, pad)
            
            // Title Header
            addView(TextView(context).apply {
                text = "Wrriter Action Overlay"
                setTextColor(Color.WHITE)
                textSize = 16f
                fontWeight = FontWeight.Bold
                gravity = Gravity.CENTER_HORIZONTAL
            })

            Spacer(this, 12)

            // Quick Write Button
            addView(createMenuButton("Quick Write Note") {
                removeViewSafely(menuCard)
                menuCard = null
                showQuickWriteDialog()
            })

            // Record Voice Button
            addView(createMenuButton("Record Voice Note") {
                removeViewSafely(menuCard)
                menuCard = null
                showVoiceRecorderDialog()
            })

            // Open Notes App Button
            addView(createMenuButton("Open Notes App") {
                removeViewSafely(menuCard)
                menuCard = null
                createFloatingButton()
                
                val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                }
                if (launchIntent != null) {
                    startActivity(launchIntent)
                }
            })

            Spacer(this, 8)

            // Close Menu Button
            addView(Button(context).apply {
                text = "Close Actions"
                setTextColor(0xFF64748B.toInt())
                background = null
                transformationMethod = null
                setOnClickListener {
                    removeViewSafely(menuCard)
                    menuCard = null
                    createFloatingButton()
                }
            })
        }

        val menuParams = WindowManager.LayoutParams(
            (280 * scale).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayParams.type,
            WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT
        ).apply {
            dimAmount = 0.4f
            gravity = Gravity.CENTER
        }

        windowManager?.addView(menuCard, menuParams)
    }

    private fun showQuickWriteDialog() {
        if (quickWriteDialog != null) return
        val scale = resources.displayMetrics.density
        
        quickWriteDialog = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = createCardBackground()
            val pad = (20 * scale).toInt()
            setPadding(pad, pad, pad, pad)

            addView(TextView(context).apply {
                text = "Quick Write"
                setTextColor(Color.WHITE)
                textSize = 18f
                fontWeight = FontWeight.Bold
            })

            Spacer(this, 12)

            // Title Field
            val titleInput = EditText(context).apply {
                hint = "Note Title (Optional)"
                setHintTextColor(0xFF475569.toInt())
                setTextColor(Color.WHITE)
                maxLines = 1
                textSize = 14f
                background = createFieldBackground()
                setPadding((12 * scale).toInt(), (8 * scale).toInt(), (12 * scale).toInt(), (8 * scale).toInt())
            }
            addView(titleInput)

            Spacer(this, 12)

            // Body Field
            val bodyInput = EditText(context).apply {
                hint = "Dump your thoughts here..."
                setHintTextColor(0xFF475569.toInt())
                setTextColor(Color.WHITE)
                minLines = 4
                textSize = 14f
                gravity = Gravity.TOP
                background = createFieldBackground()
                setPadding((12 * scale).toInt(), (12 * scale).toInt(), (12 * scale).toInt(), (12 * scale).toInt())
            }
            addView(bodyInput)

            Spacer(this, 16)

            // Button Row
            val buttonRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.END
            }

            // Cancel Button
            buttonRow.addView(Button(context).apply {
                text = "Cancel"
                setTextColor(0xFF64748B.toInt())
                background = null
                transformationMethod = null
                setOnClickListener {
                    removeViewSafely(quickWriteDialog)
                    quickWriteDialog = null
                    createFloatingButton()
                }
            })

            Spacer(buttonRow, 8, isHorizontal = true)

            // Save Button
            buttonRow.addView(Button(context).apply {
                text = "Save Note"
                setTextColor(Color.BLACK)
                background = createCardBackground(0xFF94A3B8.toInt(), 8f)
                transformationMethod = null
                setOnClickListener {
                    val title = titleInput.text.toString().trim()
                    val body = bodyInput.text.toString().trim()
                    if (body.isNotEmpty()) {
                        saveNoteToInbox(title.ifEmpty { "Quick Dump" }, body)
                        removeViewSafely(quickWriteDialog)
                        quickWriteDialog = null
                        createFloatingButton()
                    } else {
                        Toast.makeText(context, "Note content cannot be empty", Toast.LENGTH_SHORT).show()
                    }
                }
            })

            addView(buttonRow)
        }

        val writeParams = WindowManager.LayoutParams(
            (320 * scale).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayParams.type,
            WindowManager.LayoutParams.FLAG_DIM_BEHIND or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            dimAmount = 0.5f
            gravity = Gravity.CENTER
        }

        windowManager?.addView(quickWriteDialog, writeParams)
    }

    private fun showVoiceRecorderDialog() {
        if (voiceRecorderDialog != null) return
        val scale = resources.displayMetrics.density

        recordSeconds = 0
        isRecording = true
        startRecordingAudio()

        voiceRecorderDialog = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = createCardBackground()
            val pad = (20 * scale).toInt()
            setPadding(pad, pad, pad, pad)
            gravity = Gravity.CENTER_HORIZONTAL

            addView(TextView(context).apply {
                text = "Recording Voice Note"
                setTextColor(Color.WHITE)
                textSize = 16f
                fontWeight = FontWeight.Bold
            })

            Spacer(this, 16)

            // Timer display
            val timerText = TextView(context).apply {
                text = "00:00"
                setTextColor(0xFF94A3B8.toInt()) // Slate grey highlight
                textSize = 32f
                fontWeight = FontWeight.Bold
            }
            addView(timerText)

            Spacer(this, 20)

            // Button Row
            val buttonRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_HORIZONTAL
            }

            // Cancel button
            buttonRow.addView(Button(context).apply {
                text = "Cancel"
                setTextColor(0xFF64748B.toInt())
                background = null
                transformationMethod = null
                setOnClickListener {
                    stopRecordingTimer()
                    try {
                        audioRecorder.stop()
                        if (tempAudioFile.exists()) tempAudioFile.delete()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    removeViewSafely(voiceRecorderDialog)
                    voiceRecorderDialog = null
                    isRecording = false
                    createFloatingButton()
                }
            })

            Spacer(buttonRow, 16, isHorizontal = true)

            // Stop & Save button
            buttonRow.addView(Button(context).apply {
                text = "Stop & Save"
                setTextColor(Color.WHITE)
                background = createCardBackground(0xFFEF4444.toInt(), 8f) // Red accent
                transformationMethod = null
                setOnClickListener {
                    stopRecordingTimer()
                    saveVoiceNoteToInbox()
                    removeViewSafely(voiceRecorderDialog)
                    voiceRecorderDialog = null
                    isRecording = false
                    createFloatingButton()
                }
            })

            addView(buttonRow)

            // Start Timer updates
            startRecordingTimer { seconds ->
                val mins = seconds / 60
                val secs = seconds % 60
                timerText.text = String.format("%02d:%02d", mins, secs)
            }
        }

        val recordParams = WindowManager.LayoutParams(
            (280 * scale).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayParams.type,
            WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT
        ).apply {
            dimAmount = 0.5f
            gravity = Gravity.CENTER
        }

        windowManager?.addView(voiceRecorderDialog, recordParams)
    }

    private fun startRecordingAudio() {
        try {
            if (tempAudioFile.exists()) tempAudioFile.delete()
            audioRecorder.start(tempAudioFile)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to start recording", Toast.LENGTH_SHORT).show()
        }
    }

    private fun saveNoteToInbox(title: String, body: String) {
        serviceScope.launch {
            try {
                val vaultUri = preferencesManager.vaultUriFlow.first()
                if (vaultUri.isNullOrEmpty()) {
                    mainHandler.post {
                        Toast.makeText(this@FloatingWidgetService, "Please configure vault workspace first", Toast.LENGTH_LONG).show()
                    }
                    return@launch
                }
                
                withContext(Dispatchers.IO) {
                    vaultManager.createNote(vaultUri, "Inbox", title, body)
                    vaultManager.rebuildCache(vaultUri)
                }

                mainHandler.post {
                    Toast.makeText(this@FloatingWidgetService, "Note saved to Inbox", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                mainHandler.post {
                    Toast.makeText(this@FloatingWidgetService, "Failed to save note", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun saveVoiceNoteToInbox() {
        serviceScope.launch {
            try {
                val vaultUriString = preferencesManager.vaultUriFlow.first()
                if (vaultUriString.isNullOrEmpty()) {
                    mainHandler.post {
                        Toast.makeText(this@FloatingWidgetService, "Please configure vault workspace first", Toast.LENGTH_LONG).show()
                    }
                    return@launch
                }

                withContext(Dispatchers.IO) {
                    audioRecorder.stop()
                    if (!tempAudioFile.exists() || tempAudioFile.length() == 0L) {
                        return@withContext
                    }

                    val rootUri = Uri.parse(vaultUriString)
                    val rootDir = DocumentFile.fromTreeUri(applicationContext, rootUri) ?: return@withContext
                    val attachmentsDir = rootDir.findFile("Attachments") ?: rootDir.createDirectory("Attachments") ?: return@withContext

                    val dateString = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
                    val audioFileName = "Voice_$dateString.m4a"
                    val audioFile = attachmentsDir.createFile("audio/mp4", audioFileName) ?: return@withContext

                    contentResolver.openOutputStream(audioFile.uri)?.use { output ->
                        tempAudioFile.inputStream().use { input ->
                            input.copyTo(output)
                        }
                    }
                    tempAudioFile.delete()

                    val noteTitle = "Voice Note $dateString"
                    val markdownBody = "\n\n![Voice Note](Attachments/$audioFileName)\n"
                    vaultManager.createNote(vaultUriString, "Inbox", noteTitle, markdownBody)
                    vaultManager.rebuildCache(vaultUriString)
                }

                mainHandler.post {
                    Toast.makeText(this@FloatingWidgetService, "Voice note saved to Inbox", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                e.printStackTrace()
                mainHandler.post {
                    Toast.makeText(this@FloatingWidgetService, "Failed to save voice note", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun startRecordingTimer(onTick: (Int) -> Unit) {
        recordHandler = Handler(Looper.getMainLooper())
        val tickRunnable = object : Runnable {
            override fun run() {
                recordSeconds++
                onTick(recordSeconds)
                recordHandler?.postDelayed(this, 1000)
            }
        }
        recordHandler?.post(tickRunnable)
    }

    private fun stopRecordingTimer() {
        recordHandler?.removeCallbacksAndMessages(null)
        recordHandler = null
    }

    // Programmatic view helper methods
    private fun createCardBackground(color: Int = 0xFF121212.toInt(), cornerRadiusDp: Float = 16f): GradientDrawable {
        val scale = resources.displayMetrics.density
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = cornerRadiusDp * scale
            setColor(color)
            setStroke((1.5f * scale).toInt(), 0xFF1E293B.toInt())
        }
    }

    private fun createFieldBackground(): GradientDrawable {
        val scale = resources.displayMetrics.density
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 8f * scale
            setColor(0xFF000000.toInt())
            setStroke((1f * scale).toInt(), 0xFF1E293B.toInt())
        }
    }

    private fun createMenuButton(text: String, onClick: () -> Unit): Button {
        val scale = resources.displayMetrics.density
        return Button(this).apply {
            this.text = text
            setTextColor(Color.WHITE)
            background = createCardBackground(0xFF1E293B.toInt(), 8f)
            transformationMethod = null
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (48 * scale).toInt()
            ).apply {
                setMargins(0, (8 * scale).toInt(), 0, 0)
            }
        }
    }

    private fun Spacer(container: LinearLayout, dp: Int, isHorizontal: Boolean = false) {
        val scale = resources.displayMetrics.density
        val size = (dp * scale).toInt()
        val spacer = View(this).apply {
            layoutParams = if (isHorizontal) {
                LinearLayout.LayoutParams(size, 1)
            } else {
                LinearLayout.LayoutParams(1, size)
            }
        }
        container.addView(spacer)
    }

    private fun removeViewSafely(view: View?) {
        if (view != null) {
            try {
                windowManager?.removeView(view)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Helper properties for type font bold
    private var TextView.fontWeight: Int
        get() = 0
        set(value) {
            if (value == FontWeight.Bold) {
                this.typeface = android.graphics.Typeface.DEFAULT_BOLD
            }
        }

    private object FontWeight {
        const val Bold = 1
    }
}
