package cz.smallhill.player.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Light = lightColorScheme(
    primary = Color(0xFF7048E8),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE5DEFF),
    onPrimaryContainer = Color(0xFF22005D),
    secondaryContainer = Color(0xFFE8E0F5),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFC8B8FF),
    onPrimary = Color(0xFF34009A),
    primaryContainer = Color(0xFF5A35CF),
    onPrimaryContainer = Color(0xFFE5DEFF),
    secondaryContainer = Color(0xFF4A4458),
)

@Composable
fun PlayerTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
