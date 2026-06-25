package com.rushi.wrriter.ui.screens

import android.annotation.SuppressLint
import android.net.Uri
import android.webkit.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Brush
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.documentfile.provider.DocumentFile
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import com.rushi.wrriter.data.NoteMetadata
import com.rushi.wrriter.data.VaultManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
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
    
    var noteTitle by remember { mutableStateOf("") }
    var noteBody by remember { mutableStateOf("") }
    var noteMetadata by remember { mutableStateOf<NoteMetadata?>(null) }
    var webViewInstance by remember { mutableStateOf<WebView?>(null) }
    
    // Load note content and metadata
    LaunchedEffect(noteUriString) {
        try {
            val (meta, body) = vaultManager.loadNote(noteUriString)
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
                            tint = Color(0xFFF97316) // Brand orange
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF000000) // OLED Black
                )
            )
        },
        modifier = Modifier.fillMaxSize()
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF000000))
                .padding(innerPadding)
        ) {
            if (noteMetadata != null) {
                WebViewContainer(
                    markdown = noteBody,
                    vaultUri = vaultUri,
                    onSave = { md ->
                        coroutineScope.launch {
                            val meta = noteMetadata
                            if (meta != null) {
                                vaultManager.saveNote(
                                    fileUriString = meta.uriString,
                                    title = meta.title,
                                    tags = meta.tags,
                                    isInbox = meta.isInbox,
                                    body = md
                                )
                                onBack()
                            }
                        }
                    },
                    onWikiLinkClicked = { title ->
                        coroutineScope.launch {
                            val parentUri = DocumentFile.fromSingleUri(context, Uri.parse(noteUriString))?.parentFile?.uri
                            val targetUri = if (parentUri != null) {
                                val rootDir = DocumentFile.fromTreeUri(context, parentUri)
                                val existing = rootDir?.findFile("$title.md")
                                existing?.uri?.toString()
                            } else null

                            if (targetUri != null) {
                                val (meta, _) = vaultManager.loadNote(targetUri)
                                onWikiLinkClicked(meta)
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
                                    onWikiLinkClicked(newNoteMeta)
                                }
                            }
                        }
                    },
                    onKeyPress = {
                        // Keypress recorded (used for break timers later)
                    },
                    onWebViewReady = { webView ->
                        webViewInstance = webView
                    }
                )
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewContainer(
    markdown: String,
    vaultUri: String,
    onSave: (String) -> Unit,
    onWikiLinkClicked: (String) -> Unit,
    onKeyPress: () -> Unit,
    onWebViewReady: (WebView) -> Unit
) {
    val context = LocalContext.current

    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    allowFileAccess = false
                    allowContentAccess = false
                }

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
                        val options = JSONObject().apply {
                            put("theme", "oled")
                            put("font", "default")
                            put("texture", "none")
                            put("spellcheck", true)
                            put("tabMode", "2spaces")
                        }
                        val escapedMd = escapeStringForJs(markdown)
                        evaluateJavascript(
                            "loadNoteContent('$escapedMd', '${options.toString()}')",
                            null
                        )
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
                    fun onKeyPress() {
                        onKeyPress()
                    }
                }, "EditorBridge")

                loadUrl("https://appassets.androidplatform.net/assets/editor.html")
                onWebViewReady(this)
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
