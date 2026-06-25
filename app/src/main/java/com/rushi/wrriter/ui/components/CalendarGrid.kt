package com.rushi.wrriter.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CalendarGrid(
    existingJournalDates: Set<String>,
    onDateSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var calendar by remember { mutableStateOf(Calendar.getInstance()) }
    val currentMonthYear = remember(calendar) {
        SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(calendar.time)
    }

    val daysInMonth = remember(calendar) {
        val tempCal = calendar.clone() as Calendar
        tempCal.set(Calendar.DAY_OF_MONTH, 1)
        val maxDays = tempCal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val firstDayOfWeek = tempCal.get(Calendar.DAY_OF_WEEK) // 1 (Sun) to 7 (Sat)
        
        // Convert firstDayOfWeek to 0-indexed where Monday is 0 and Sunday is 6
        val shift = (firstDayOfWeek + 5) % 7
        
        List(42) { index ->
            val dayOffset = index - shift
            if (dayOffset in 0 until maxDays) {
                val dayCal = calendar.clone() as Calendar
                dayCal.set(Calendar.DAY_OF_MONTH, dayOffset + 1)
                dayCal
            } else {
                null
            }
        }
    }

    val daysOfWeek = listOf("M", "T", "W", "T", "F", "S", "S")

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF121212), RoundedCornerShape(16.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Month Selector Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = {
                    val nextCal = calendar.clone() as Calendar
                    nextCal.add(Calendar.MONTH, -1)
                    calendar = nextCal
                }
            ) {
                Icon(
                    imageVector = Icons.Default.ChevronLeft,
                    contentDescription = "Previous Month",
                    tint = Color.White
                )
            }

            Text(
                text = currentMonthYear,
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )

            IconButton(
                onClick = {
                    val nextCal = calendar.clone() as Calendar
                    nextCal.add(Calendar.MONTH, 1)
                    calendar = nextCal
                }
            ) {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "Next Month",
                    tint = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Days of Week Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            daysOfWeek.forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    color = Color(0xFF64748B), // Slate muted
                    textAlign = TextAlign.Center,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Days Grid
        val chunkedDays = daysInMonth.chunked(7)
        chunkedDays.forEach { week ->
            if (week.any { it != null }) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    week.forEach { dayCal ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(2.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            if (dayCal != null) {
                                val dateString = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(dayCal.time)
                                val hasJournal = existingJournalDates.contains(dateString)
                                val isToday = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date()) == dateString

                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .clip(CircleShape)
                                        .background(
                                            if (isToday) Color(0xFF1E293B) else Color.Transparent
                                        )
                                        .border(
                                            width = 1.dp,
                                            color = if (hasJournal) Color(0xFFF97316) else Color.Transparent,
                                            shape = CircleShape
                                        )
                                        .clickable {
                                            onDateSelected(dateString)
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = dayCal.get(Calendar.DAY_OF_MONTH).toString(),
                                            color = if (isToday) Color(0xFFF97316) else Color.White,
                                            fontWeight = if (isToday || hasJournal) FontWeight.Bold else FontWeight.Normal,
                                            fontSize = 14.sp
                                        )
                                        if (hasJournal) {
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Box(
                                                modifier = Modifier
                                                    .size(4.dp)
                                                    .background(Color(0xFFF97316), CircleShape)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
