package dev.zavorth.companion.ui.design

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Standard inset panel for grouped Android app content.
 */
@Composable
internal fun ZavorthPanel(
  modifier: Modifier = Modifier,
  contentPadding: PaddingValues = PaddingValues(12.dp),
  content: @Composable () -> Unit,
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(ZavorthTheme.radii.panel),
    color = ZavorthTheme.colors.surfaceRaised.copy(alpha = 0.82f),
    contentColor = ZavorthTheme.colors.text,
    border = null,
    tonalElevation = 2.dp,
    shadowElevation = 4.dp,
  ) {
    Column(modifier = Modifier.padding(contentPadding)) {
      content()
    }
  }
}

/**
 * Shared empty state used when a screen has no records but can still offer an action.
 */
@Composable
internal fun ZavorthEmptyState(
  title: String,
  body: String,
  modifier: Modifier = Modifier,
  action: (@Composable () -> Unit)? = null,
) {
  ZavorthPanel(modifier = modifier) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text(text = title, style = ZavorthTheme.type.section, color = ZavorthTheme.colors.text)
      Text(text = body, style = ZavorthTheme.type.body, color = ZavorthTheme.colors.textMuted)
      action?.invoke()
    }
  }
}

/**
 * Shared loading placeholder that keeps async screen states visually consistent.
 */
@Composable
internal fun ZavorthLoadingState(
  title: String,
  modifier: Modifier = Modifier,
) {
  ZavorthPanel(modifier = modifier) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      CircularProgressIndicator(color = ZavorthTheme.colors.primary, strokeWidth = 2.dp)
      Text(text = title, style = ZavorthTheme.type.body, color = ZavorthTheme.colors.textMuted)
    }
  }
}

/**
 * Shared recoverable error block with the app's attention styling.
 */
@Composable
internal fun ZavorthErrorState(
  title: String,
  body: String,
  modifier: Modifier = Modifier,
  action: (@Composable () -> Unit)? = null,
) {
  ZavorthPanel(modifier = modifier) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      ZavorthStatusPill(text = "Needs attention", status = ZavorthStatus.Danger)
      Text(text = title, style = ZavorthTheme.type.section, color = ZavorthTheme.colors.text)
      Text(text = body, style = ZavorthTheme.type.body, color = ZavorthTheme.colors.textMuted)
      action?.invoke()
    }
  }
}
