package dev.zavorth.companion.ui.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * Stable bottom-navigation destination descriptor.
 */
@Immutable
internal data class ZavorthNavItem(
  val key: String,
  val label: String,
  val icon: ImageVector,
)

/**
 * Compact app bar that keeps title, optional subtitle, navigation, and actions aligned.
 */
@Composable
internal fun ZavorthTopBar(
  title: String,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  navigation: (@Composable () -> Unit)? = null,
  actions: (@Composable () -> Unit)? = null,
) {
  Row(
    modifier =
      modifier
        .fillMaxWidth()
        .padding(horizontal = ZavorthTheme.spacing.lg, vertical = ZavorthTheme.spacing.sm),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    navigation?.invoke()
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(
        text = title,
        style = ZavorthTheme.type.section,
        color = ZavorthTheme.colors.text,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      if (subtitle != null) {
        Text(
          text = subtitle,
          style = ZavorthTheme.type.caption,
          color = ZavorthTheme.colors.textSubtle,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
    actions?.invoke()
  }
}

/**
 * Bottom navigation shell that applies navigation-bar insets before laying out destinations.
 */
@Composable
internal fun ZavorthBottomNav(
  items: List<ZavorthNavItem>,
  selectedKey: String,
  onSelect: (String) -> Unit,
  modifier: Modifier = Modifier,
) {
  val safeInsets = WindowInsets.navigationBars.only(androidx.compose.foundation.layout.WindowInsetsSides.Bottom)

  Box(modifier = modifier.fillMaxWidth().background(ZavorthTheme.colors.canvas)) {
    Surface(
      modifier = Modifier.fillMaxWidth(),
      color = ZavorthTheme.colors.surface.copy(alpha = 0.92f),
      border = BorderStroke(1.dp, ZavorthTheme.colors.border.copy(alpha = 0.42f)),
      shape = RoundedCornerShape(topStart = ZavorthTheme.radii.sheet, topEnd = ZavorthTheme.radii.sheet),
      tonalElevation = 2.dp,
      shadowElevation = 8.dp,
    ) {
      Row(
        modifier =
          Modifier
            .windowInsetsPadding(safeInsets)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        items.forEach { item ->
          ZavorthBottomNavItem(
            item = item,
            selected = item.key == selectedKey,
            onClick = { onSelect(item.key) },
            modifier = Modifier.weight(1f),
          )
        }
      }
    }
  }
}

@Composable
private fun ZavorthBottomNavItem(
  item: ZavorthNavItem,
  selected: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Surface(
    onClick = onClick,
    modifier = modifier.heightIn(min = 48.dp),
    shape = RoundedCornerShape(ZavorthTheme.radii.control),
    color = if (selected) ZavorthTheme.colors.surfacePressed.copy(alpha = 0.72f) else Color.Transparent,
    contentColor = if (selected) ZavorthTheme.colors.text else ZavorthTheme.colors.textMuted,
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 5.dp, vertical = 5.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
      Icon(imageVector = item.icon, contentDescription = item.label, modifier = Modifier.size(18.dp))
      Text(text = item.label, style = ZavorthTheme.type.caption, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}

/**
 * Two-character identity mark for users, agents, or nodes in compact UI rows.
 */
@Composable
internal fun ZavorthAvatarMark(
  text: String,
  modifier: Modifier = Modifier,
) {
  Surface(
    modifier = modifier.size(38.dp),
    shape = CircleShape,
    color = ZavorthTheme.colors.surfaceRaised,
    contentColor = ZavorthTheme.colors.text,
    border = BorderStroke(1.dp, ZavorthTheme.colors.border),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Text(text = text.take(2).uppercase(), style = ZavorthTheme.type.label)
    }
  }
}
