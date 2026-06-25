package com.rushi.wrriter.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Paint
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.documentfile.provider.DocumentFile
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

data class StrokePath(
    val path: Path,
    val points: List<Offset> // Retain coordinates for Bitmap reconstruction
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DrawingPadScreen(
    vaultUri: String,
    onBack: () -> Unit,
    onDrawingSaved: (String) -> Unit
) {
    val context = LocalContext.current
    
    val paths = remember { mutableStateListOf<StrokePath>() }
    var currentPathPoints = remember { mutableStateListOf<Offset>() }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Drawing Pad", color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { paths.clear() }) {
                        Icon(Icons.Default.Clear, "Clear Canvas", tint = Color.White)
                    }
                    IconButton(
                        onClick = {
                            if (paths.isEmpty()) {
                                Toast.makeText(context, "Canvas is empty", Toast.LENGTH_SHORT).show()
                                return@IconButton
                            }
                            // Save drawing
                            val fileName = saveDrawingToVault(
                                context = context,
                                vaultUriString = vaultUri,
                                paths = paths,
                                size = canvasSize
                            )
                            if (fileName != null) {
                                onDrawingSaved(fileName)
                            }
                        }
                    ) {
                        Icon(Icons.Default.Save, "Save", tint = Color(0xFFF97316))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF000000))
            )
        },
        modifier = Modifier.fillMaxSize()
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF000000))
                .padding(innerPadding)
        ) {
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF121212)) // Dark canvas area
                    .onSizeChanged { canvasSize = it }
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { offset ->
                                currentPathPoints.clear()
                                currentPathPoints.add(offset)
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                currentPathPoints.add(change.position)
                            },
                            onDragEnd = {
                                if (currentPathPoints.isNotEmpty()) {
                                    val newPath = Path().apply {
                                        moveTo(currentPathPoints.first().x, currentPathPoints.first().y)
                                        for (i in 1 until currentPathPoints.size) {
                                            lineTo(currentPathPoints[i].x, currentPathPoints[i].y)
                                        }
                                    }
                                    paths.add(StrokePath(newPath, currentPathPoints.toList()))
                                }
                            }
                        )
                    }
            ) {
                // Draw past paths
                paths.forEach { strokePath ->
                    drawPath(
                        path = strokePath.path,
                        color = Color.White,
                        style = Stroke(width = 8f)
                    )
                }
                
                // Draw current drawing path
                if (currentPathPoints.isNotEmpty()) {
                    val tempPath = Path().apply {
                        moveTo(currentPathPoints.first().x, currentPathPoints.first().y)
                        for (i in 1 until currentPathPoints.size) {
                            lineTo(currentPathPoints[i].x, currentPathPoints[i].y)
                        }
                    }
                    drawPath(
                        path = tempPath,
                        color = Color.White,
                        style = Stroke(width = 8f)
                    )
                }
            }
        }
    }
}

private fun saveDrawingToVault(
    context: Context,
    vaultUriString: String,
    paths: List<StrokePath>,
    size: IntSize
): String? {
    try {
        val width = if (size.width > 0) size.width else 1080
        val height = if (size.height > 0) size.height else 1920

        // Create software bitmap
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        canvas.drawColor(android.graphics.Color.BLACK) // Strict OLED Black background

        val paint = Paint().apply {
            color = android.graphics.Color.WHITE
            style = Paint.Style.STROKE
            strokeWidth = 8f
            isAntiAlias = true
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }

        // Reconstruct the paths on the bitmap
        for (strokePath in paths) {
            val androidPath = android.graphics.Path()
            val points = strokePath.points
            if (points.isNotEmpty()) {
                androidPath.moveTo(points.first().x, points.first().y)
                for (i in 1 until points.size) {
                    androidPath.lineTo(points[i].x, points[i].y)
                }
                canvas.drawPath(androidPath, paint)
            }
        }

        // Save to cache first
        val tempFile = File(context.cacheDir, "temp_drawing.png")
        tempFile.outputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }

        // Export to SAF Attachments folder
        val rootUri = Uri.parse(vaultUriString)
        val rootDir = DocumentFile.fromTreeUri(context, rootUri) ?: return null
        val attachmentsDir = rootDir.findFile("Attachments") ?: rootDir.createDirectory("Attachments") ?: return null

        val dateString = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val pngFileName = "Drawing_$dateString.png"
        val docFile = attachmentsDir.createFile("image/png", pngFileName) ?: return null

        context.contentResolver.openOutputStream(docFile.uri)?.use { output ->
            tempFile.inputStream().use { input ->
                input.copyTo(output)
            }
        }
        tempFile.delete()
        bitmap.recycle()

        Toast.makeText(context, "Drawing saved to Attachments", Toast.LENGTH_SHORT).show()
        return "Attachments/$pngFileName"
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Failed to save drawing", Toast.LENGTH_SHORT).show()
        return null
    }
}
