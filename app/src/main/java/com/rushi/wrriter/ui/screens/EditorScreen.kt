package com.rushi.wrriter.ui.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.*
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Brush
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.documentfile.provider.DocumentFile
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.VaultManager
import com.rushi.wrriter.data.PreferencesManager
import com.rushi.wrriter.service.BreakReminderService
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    vaultManager: VaultManager,
    vaultUri: String,
    noteUriString: String,
    onBack: () -> Unit,
    onWikiLinkClicked: (NoteMetadata) -> Unit,
    onInsertDrawingRequest: () -> Unit,
    insertedDrawingPath: String? = null,
    onInsertedDrawingConsumed: () -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    
    val preferencesManager = remember { PreferencesManager(context) }
    val theme = preferencesManager.themeFlow.collectAsState(initial = "oled").value
    val font = preferencesManager.fontFlow.collectAsState(initial = "default").value
    val texture = preferencesManager.textureFlow.collectAsState(initial = "none").value
    val spellcheck = preferencesManager.spellcheckFlow.collectAsState(initial = true).value
    val tabMode = preferencesManager.tabModeFlow.collectAsState(initial = "2spaces").value

    var noteTitle by remember { mutableStateOf("") }
    var noteBody by remember { mutableStateOf("") }
    var noteMetadata by remember { mutableStateOf<NoteMetadata?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    var showReminderBottomSheet by remember { mutableStateOf(false) }
    var selectedDateText by remember { mutableStateOf("No date selected") }
    var selectedTimeText by remember { mutableStateOf("No time selected") }
    val calendar = remember { java.util.Calendar.getInstance() }
    var isDateTimeSelected by remember { mutableStateOf(false) }

    val datePickerDialog = remember {
        android.app.DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                calendar.set(java.util.Calendar.YEAR, year)
                calendar.set(java.util.Calendar.MONTH, month)
                calendar.set(java.util.Calendar.DAY_OF_MONTH, dayOfMonth)
                selectedDateText = String.format("%04d-%02d-%02d", year, month + 1, dayOfMonth)
                isDateTimeSelected = selectedTimeText != "No time selected"
            },
            calendar.get(java.util.Calendar.YEAR),
            calendar.get(java.util.Calendar.MONTH),
            calendar.get(java.util.Calendar.DAY_OF_MONTH)
        )
    }

    val timePickerDialog = remember {
        android.app.TimePickerDialog(
            context,
            { _, hourOfDay, minute ->
                calendar.set(java.util.Calendar.HOUR_OF_DAY, hourOfDay)
                calendar.set(java.util.Calendar.MINUTE, minute)
                calendar.set(java.util.Calendar.SECOND, 0)
                calendar.set(java.util.Calendar.MILLISECOND, 0)
                selectedTimeText = String.format("%02d:%02d", hourOfDay, minute)
                isDateTimeSelected = selectedDateText != "No date selected"
            },
            calendar.get(java.util.Calendar.HOUR_OF_DAY),
            calendar.get(java.util.Calendar.MINUTE),
            false
        )
    }
    
    // Load note content and metadata
    LaunchedEffect(noteUriString) {
        try {
            val (meta, body) = withContext(Dispatchers.IO) {
                vaultManager.loadNote(noteUriString)
            }
            noteMetadata = meta
            noteTitle = meta.title
            noteBody = body
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Insert drawings if returned from drawing screen
    LaunchedEffect(insertedDrawingPath, webViewInstance) {
        val webView = webViewInstance
        if (insertedDrawingPath != null && webView != null) {
            webView.evaluateJavascript("insertAttachment('$insertedDrawingPath', 'Drawing')", null)
            onInsertedDrawingConsumed()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            val intent = Intent(context, BreakReminderService::class.java).apply {
                action = BreakReminderService.ACTION_EDITOR_CLOSED
            }
            context.startService(intent)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = noteTitle,
                        color = Color.White
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    // Set Reminder Icon
                    IconButton(onClick = { showReminderBottomSheet = true }) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Set Reminder",
                            tint = Color.White
                        )
                    }
                    // Brush/Drawing Icon
                    IconButton(onClick = onInsertDrawingRequest) {
                        Icon(
                            imageVector = Icons.Default.Brush,
                            contentDescription = "Insert Drawing",
                            tint = Color.White
                        )
                    }
                    IconButton(
                        onClick = {
                            // Request WebView to compile and save content
                            webViewInstance?.evaluateJavascript("requestSave()", null)
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Save",
                            tint = Color(0xFF94A3B8) // Brand slate grey
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF000000) // OLED Black
                )
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF000000))
                .padding(innerPadding)
                .imePadding()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                if (noteMetadata != null) {
                    WebViewContainer(
                        markdown = noteBody,
                        vaultUri = vaultUri,
                        theme = theme,
                        font = font,
                        texture = texture,
                        spellcheck = spellcheck,
                        tabMode = tabMode,
                        onSave = { md ->
                            coroutineScope.launch(Dispatchers.IO) {
                                val meta = noteMetadata
                                if (meta != null) {
                                    vaultManager.saveNote(
                                        fileUriString = meta.uriString,
                                        title = meta.title,
                                        tags = meta.tags,
                                        isInbox = meta.isInbox,
                                        body = md
                                    )
                                    withContext(Dispatchers.Main) {
                                        onBack()
                                    }
                                }
                            }
                        },
                        onWikiLinkClicked = { title ->
                            coroutineScope.launch(Dispatchers.IO) {
                                val parentUri = DocumentFile.fromSingleUri(context, Uri.parse(noteUriString))?.parentFile?.uri
                                val targetUri = if (parentUri != null) {
                                    val rootDir = DocumentFile.fromTreeUri(context, parentUri)
                                    val existing = rootDir?.findFile("$title.md")
                                    existing?.uri?.toString()
                                } else null

                                if (targetUri != null) {
                                    val (meta, _) = vaultManager.loadNote(targetUri)
                                    withContext(Dispatchers.Main) {
                                        onWikiLinkClicked(meta)
                                    }
                                } else {
                                    // Create new note automatically under the current folder parent directory
                                    val rootDir = DocumentFile.fromSingleUri(context, Uri.parse(noteUriString))?.parentFile
                                    if (rootDir != null) {
                                        val newNoteMeta = vaultManager.createNote(
                                            rootUriString = rootDir.parentFile!!.uri.toString(),
                                            folderName = rootDir.name ?: "Inbox",
                                            title = title,
                                            body = ""
                                        )
                                        withContext(Dispatchers.Main) {
                                            onWikiLinkClicked(newNoteMeta)
                                        }
                                    }
                                }
                            }
                        },
                        onKeyPress = {
                            val intent = Intent(context, BreakReminderService::class.java).apply {
                                action = BreakReminderService.ACTION_KEYPRESS
                            }
                            context.startService(intent)
                        },
                        onWebViewReady = { webView ->
                            webViewInstance = webView
                        }
                    )
                }
            }

            // Formatting options toolbar placed right above the soft keyboard
            FormattingBar(
                onAction = { action ->
                    val webView = webViewInstance
                    if (webView != null) {
                        when (action) {
                            "undo" -> webView.evaluateJavascript("formatText('undo')", null)
                            "redo" -> webView.evaluateJavascript("formatText('redo')", null)
                            "checklist" -> webView.evaluateJavascript("insertChecklist()", null)
                            "wikiLink" -> webView.evaluateJavascript("insertWikiLink()", null)
                            "tag" -> webView.evaluateJavascript("insertTag()", null)
                            "heading" -> webView.evaluateJavascript("insertHeading()", null)
                            "bold" -> webView.evaluateJavascript("formatText('bold')", null)
                            "italic" -> webView.evaluateJavascript("formatText('italic')", null)
                            "strikethrough" -> webView.evaluateJavascript("formatText('strikeThrough')", null)
                        }
                    }
                },
                onAttachClick = onInsertDrawingRequest
            )
        }
    }

    if (showReminderBottomSheet) {
        ModalBottomSheet(
            onDismissRequest = { showReminderBottomSheet = false },
            sheetState = rememberModalBottomSheetState(),
            containerColor = Color(0xFF121212),
            contentColor = Color.White,
            dragHandle = { BottomSheetDefaults.DragHandle(color = Color(0xFF475569)) }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Set Custom Reminder",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                
                Text(
                    text = "Select a custom date and time to schedule a notification reminder for this note.",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp
                )

                // Date Picker trigger button
                Button(
                    onClick = { datePickerDialog.show() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1E293B),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(text = "Select Date: $selectedDateText")
                }

                // Time Picker trigger button
                Button(
                    onClick = { timePickerDialog.show() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1E293B),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(text = "Select Time: $selectedTimeText")
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Set Alarm
                    Button(
                        onClick = {
                            if (isDateTimeSelected) {
                                val triggerTime = calendar.timeInMillis
                                if (triggerTime <= System.currentTimeMillis()) {
                                    Toast.makeText(context, "Please select a future date and time", Toast.LENGTH_SHORT).show()
                                } else {
                                    com.rushi.wrriter.receiver.AlarmReceiver.scheduleAlarm(context, noteUriString, noteTitle, triggerTime)
                                    Toast.makeText(context, "Reminder set successfully", Toast.LENGTH_SHORT).show()
                                    showReminderBottomSheet = false
                                }
                            } else {
                                Toast.makeText(context, "Please select both date and time", Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF94A3B8), // Brand Slate Grey
                            contentColor = Color.Black
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Set Reminder", fontWeight = FontWeight.Bold)
                    }

                    // Cancel Alarm
                    Button(
                        onClick = {
                            com.rushi.wrriter.receiver.AlarmReceiver.cancelAlarm(context, noteUriString)
                            Toast.makeText(context, "Reminder cancelled", Toast.LENGTH_SHORT).show()
                            showReminderBottomSheet = false
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEF4444), // Red
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Cancel Reminder")
                    }
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewContainer(
    markdown: String,
    vaultUri: String,
    theme: String,
    font: String,
    texture: String,
    spellcheck: Boolean,
    tabMode: String,
    onSave: (String) -> Unit,
    onWikiLinkClicked: (String) -> Unit,
    onKeyPress: () -> Unit,
    onWebViewReady: (WebView) -> Unit
) {
    val context = LocalContext.current
    var isLoaded by remember { mutableStateOf(false) }

    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = false
                    allowContentAccess = false
                }

                // Prevent native WebView white background from showing through
                setBackgroundColor(android.graphics.Color.BLACK)

                // Secure Local Assets and dynamic attachments Loading
                val assetLoader = WebViewAssetLoader.Builder()
                    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(ctx))
                    .addPathHandler("/attachments/", object : WebViewAssetLoader.PathHandler {
                        override fun handle(path: String): WebResourceResponse? {
                            return try {
                                val rootUri = Uri.parse(vaultUri)
                                val rootDir = DocumentFile.fromTreeUri(ctx, rootUri)
                                val attachmentsDir = rootDir?.findFile("Attachments")
                                val targetFile = attachmentsDir?.findFile(path)
                                if (targetFile != null) {
                                    val inputStream = ctx.contentResolver.openInputStream(targetFile.uri)
                                    val mimeType = ctx.contentResolver.getType(targetFile.uri) ?: "image/png"
                                    WebResourceResponse(mimeType, "UTF-8", inputStream)
                                } else null
                            } catch (e: Exception) {
                                e.printStackTrace()
                                null
                            }
                        }
                    })
                    .build()

                webViewClient = object : WebViewClientCompat() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? {
                        return assetLoader.shouldInterceptRequest(request.url)
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        isLoaded = true
                    }
                }

                // JS-Kotlin communications bridge
                addJavascriptInterface(object {
                    @JavascriptInterface
                    fun onSaveContent(md: String) {
                        onSave(md)
                    }

                    @JavascriptInterface
                    fun onLinkClicked(title: String) {
                        onWikiLinkClicked(title)
                    }

                    @JavascriptInterface
                    fun onExternalLinkClicked(url: String) {
                        val handler = android.os.Handler(android.os.Looper.getMainLooper())
                        handler.post {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                context.startActivity(intent)
                            } catch (e: Exception) {
                                e.printStackTrace()
                                Toast.makeText(context, "No app found to open link", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }

                    @JavascriptInterface
                    fun onKeyPress() {
                        onKeyPress()
                    }
                }, "EditorBridge")

                loadUrl("https://appassets.androidplatform.net/assets/editor.html")
                onWebViewReady(this)
            }
        },
        update = { webView ->
            if (isLoaded) {
                val options = JSONObject().apply {
                    put("theme", theme)
                    put("font", font)
                    put("texture", texture)
                    put("spellcheck", spellcheck)
                    put("tabMode", tabMode)
                }
                val optionsStr = options.toString()

                val lastKey = webView.tag as? Pair<*, *>
                val currentKey = Pair(markdown, optionsStr)

                if (lastKey != currentKey) {
                    webView.tag = currentKey
                    if (lastKey?.first != markdown) {
                        val escapedMd = escapeStringForJs(markdown)
                        webView.evaluateJavascript("loadNoteContent('$escapedMd', '$optionsStr')", null)
                    } else {
                        webView.evaluateJavascript("updateEditorOptions('$optionsStr')", null)
                    }
                }
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

private fun escapeStringForJs(str: String): String {
    return str.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
}

@Composable
fun FormattingBar(
    onAction: (String) -> Unit,
    onAttachClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF121212)) // Slate dark container matching theme
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Undo
        IconButton(onClick = { onAction("undo") }) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Undo,
                contentDescription = "Undo",
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
        // Redo
        IconButton(onClick = { onAction("redo") }) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Redo,
                contentDescription = "Redo",
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
        // Checklist
        IconButton(onClick = { onAction("checklist") }) {
            Text(
                text = "[ ]",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = Color.White
            )
        }
        // Wiki Link / Document
        IconButton(onClick = { onAction("wikiLink") }) {
            Icon(
                imageVector = Icons.Default.Description,
                contentDescription = "Wiki Link",
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
        // Tag
        IconButton(onClick = { onAction("tag") }) {
            Icon(
                imageVector = Icons.Default.Tag,
                contentDescription = "Insert Tag",
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
        // Paperclip Attachment
        IconButton(onClick = onAttachClick) {
            Icon(
                imageVector = Icons.Default.AttachFile,
                contentDescription = "Insert Drawing",
                tint = Color.White,
                modifier = Modifier.size(20.dp)
            )
        }
        // Heading
        IconButton(onClick = { onAction("heading") }) {
            Text(
                text = "H",
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                color = Color.White
            )
        }
        // Bold
        IconButton(onClick = { onAction("bold") }) {
            Text(
                text = "B",
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                color = Color.White
            )
        }
        // Italic
        IconButton(onClick = { onAction("italic") }) {
            Text(
                text = "I",
                style = TextStyle(fontStyle = FontStyle.Italic),
                fontSize = 17.sp,
                color = Color.White
            )
        }
        // Strikethrough
        IconButton(onClick = { onAction("strikethrough") }) {
            Text(
                text = "S",
                style = TextStyle(textDecoration = TextDecoration.LineThrough),
                fontSize = 17.sp,
                color = Color.White
            )
        }
    }
}
