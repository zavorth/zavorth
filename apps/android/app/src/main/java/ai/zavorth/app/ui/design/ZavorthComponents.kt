package dev.zavorth.companion.ui.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal enum class ZavorthStatus {
  Neutral,
  Success,
  Warning,
  Danger,
}

/** Full-screen mobile scaffold that applies Zavorth safe-area and canvas tokens. */
@Composable
internal fun ZavorthScaffold(
  modifier: Modifier = Modifier,
  contentPadding: PaddingValues = PaddingValues(horizontal = ZavorthTheme.spacing.lg, vertical = ZavorthTheme.spacing.lg),
  contentWindowInsets: WindowInsets = WindowInsets.safeDrawing,
  content: @Composable () -> Unit,
) {
  Box(
    modifier =
      modifier
        .fillMaxSize()
        .background(ZavorthTheme.colors.canvas)
        .windowInsetsPadding(contentWindowInsets)
        .padding(contentPadding),
  ) {
    content()
  }
}

/** Section title row with an optional trailing action slot. */
@Composable
internal fun ZavorthSectionHeader(
  title: String,
  modifier: Modifier = Modifier,
  action: (@Composable () -> Unit)? = null,
) {
  Row(
    modifier = modifier.fillMaxWidth(),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    Text(
      text = title,
      style = ZavorthTheme.type.section,
      color = ZavorthTheme.colors.text,
    )
    action?.invoke()
  }
}

/** Primary call-to-action button using the mobile design token set. */
@Composable
internal fun ZavorthPrimaryButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  icon: ImageVector? = null,
) {
  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.heightIn(min = ZavorthTheme.spacing.touchTarget),
    shape = RoundedCornerShape(ZavorthTheme.radii.button),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = ZavorthTheme.colors.primary,
        contentColor = ZavorthTheme.colors.primaryText,
        disabledContainerColor = ZavorthTheme.colors.surfacePressed,
        disabledContentColor = ZavorthTheme.colors.textSubtle,
      ),
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
    elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
  ) {
    if (icon != null) {
      Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(16.dp))
      Spacer(modifier = Modifier.width(8.dp))
    }
    Text(text = text, style = ZavorthTheme.type.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

/** Secondary action button for non-default commands. */
@Composable
internal fun ZavorthSecondaryButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
  icon: ImageVector? = null,
) {
  Surface(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.heightIn(min = ZavorthTheme.spacing.touchTarget),
    shape = RoundedCornerShape(ZavorthTheme.radii.button),
    color = if (enabled) ZavorthTheme.colors.surfaceRaised else ZavorthTheme.colors.surface,
    contentColor = if (enabled) ZavorthTheme.colors.text else ZavorthTheme.colors.textSubtle,
    border = BorderStroke(1.dp, if (enabled) ZavorthTheme.colors.borderStrong else ZavorthTheme.colors.border),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.Center,
    ) {
      if (icon != null) {
        Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(7.dp))
      }
      Text(text = text, style = ZavorthTheme.type.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}

/** Fixed-size circular icon button for toolbar actions. */
@Composable
internal fun ZavorthIconButton(
  icon: ImageVector,
  contentDescription: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  enabled: Boolean = true,
) {
  Surface(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.size(ZavorthTheme.spacing.touchTarget),
    shape = CircleShape,
    color = if (enabled) ZavorthTheme.colors.surfaceRaised else ZavorthTheme.colors.surface,
    contentColor = if (enabled) ZavorthTheme.colors.text else ZavorthTheme.colors.textSubtle,
    border = BorderStroke(1.dp, ZavorthTheme.colors.border),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Icon(imageVector = icon, contentDescription = contentDescription, modifier = Modifier.size(18.dp))
    }
  }
}

/** Transparent circular icon button for low-emphasis toolbar actions. */
@Composable
internal fun ZavorthPlainIconButton(
  icon: ImageVector,
  contentDescription: String,
  onClick: () -> Unit,
) {
  Surface(
    onClick = onClick,
    modifier = Modifier.size(ZavorthTheme.spacing.touchTarget),
    shape = CircleShape,
    color = Color.Transparent,
    contentColor = ZavorthTheme.colors.text,
  ) {
    Box(contentAlignment = Alignment.Center) {
      Icon(imageVector = icon, contentDescription = contentDescription, modifier = Modifier.size(18.dp))
    }
  }
}

/** Compact label/value row for health and readiness summaries. */
@Composable
internal fun ZavorthStatusRow(
  title: String,
  value: String,
  healthy: Boolean,
  modifier: Modifier = Modifier,
) {
  Row(
    modifier = modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(9.dp),
  ) {
    Text(
      text = title,
      style = ZavorthTheme.type.body,
      color = ZavorthTheme.colors.text,
      modifier = Modifier.weight(1f),
      maxLines = 1,
    )
    ZavorthStatusPill(
      text = value,
      status = if (healthy) ZavorthStatus.Success else ZavorthStatus.Warning,
    )
  }
}

/** Compact status chip with a semantic color dot. */
@Composable
internal fun ZavorthStatusPill(
  text: String,
  status: ZavorthStatus,
  modifier: Modifier = Modifier,
) {
  val colors = ZavorthTheme.colors
  val (dotColor, backgroundColor) =
    when (status) {
      ZavorthStatus.Neutral -> colors.textSubtle to colors.surfaceRaised
      ZavorthStatus.Success -> colors.success to colors.successSoft
      ZavorthStatus.Warning -> colors.warning to colors.warningSoft
      ZavorthStatus.Danger -> colors.danger to colors.dangerSoft
    }

  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(ZavorthTheme.radii.control),
    color = backgroundColor,
    border = BorderStroke(1.dp, ZavorthTheme.colors.border),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
      Box(
        modifier =
          Modifier
            .size(5.dp)
            .clip(CircleShape)
            .background(dotColor),
      )
      Text(text = text, style = ZavorthTheme.type.caption.copy(fontSize = 13.sp, lineHeight = 17.sp), color = ZavorthTheme.colors.textMuted, maxLines = 1)
    }
  }
}

/** Small optional-selectable pill used for filters and metadata chips. */
@Composable
internal fun ZavorthPill(
  text: String,
  modifier: Modifier = Modifier,
  selected: Boolean = false,
  onClick: (() -> Unit)? = null,
) {
  val surfaceModifier =
    if (onClick == null) {
      modifier
    } else {
      modifier.clickable(onClick = onClick)
    }

  Surface(
    modifier = surfaceModifier,
    shape = RoundedCornerShape(ZavorthTheme.radii.pill),
    color = if (selected) ZavorthTheme.colors.primary else ZavorthTheme.colors.surfaceRaised,
    contentColor = if (selected) ZavorthTheme.colors.primaryText else ZavorthTheme.colors.textMuted,
    border = BorderStroke(1.dp, if (selected) ZavorthTheme.colors.primary else ZavorthTheme.colors.border),
  ) {
    Text(
      text = text,
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      style = ZavorthTheme.type.caption,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
  }
}

/** Panel wrapper for homogeneous lists with standard row separators. */
@Composable
internal fun <T> ZavorthListPanel(
  items: List<T>,
  modifier: Modifier = Modifier,
  row: @Composable (T) -> Unit,
) {
  ZavorthPanel(modifier = modifier, contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp)) {
    ZavorthSeparatedColumn(items = items, row = row)
  }
}

/** Column helper that inserts standard dividers between rendered rows. */
@Composable
internal fun <T> ZavorthSeparatedColumn(
  items: List<T>,
  modifier: Modifier = Modifier,
  row: @Composable (T) -> Unit,
) {
  Column(modifier = modifier) {
    items.forEachIndexed { index, item ->
      row(item)
      if (index != items.lastIndex) {
        HorizontalDivider(color = ZavorthTheme.colors.border.copy(alpha = 0.82f), thickness = 1.dp)
      }
    }
  }
}

/** Two-line settings/detail row with caller-provided leading and trailing slots. */
@Composable
internal fun ZavorthDetailRow(
  title: String,
  subtitle: String,
  modifier: Modifier = Modifier,
  leading: @Composable () -> Unit,
  trailing: @Composable () -> Unit,
) {
  Row(
    modifier =
      modifier
        .fillMaxWidth()
        .heightIn(min = 54.dp)
        .padding(horizontal = 0.dp, vertical = 7.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(9.dp),
  ) {
    leading()
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
      Text(text = title, style = ZavorthTheme.type.body, color = ZavorthTheme.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text(text = subtitle, style = ZavorthTheme.type.caption, color = ZavorthTheme.colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
    trailing()
  }
}

/** Circular text badge used for compact numeric or initials-style row marks. */
@Composable
internal fun ZavorthTextBadge(
  text: String,
  modifier: Modifier = Modifier,
) {
  Surface(
    modifier = modifier.size(30.dp),
    shape = CircleShape,
    color = ZavorthTheme.colors.surfacePressed,
    border = BorderStroke(1.dp, ZavorthTheme.colors.border),
    contentColor = ZavorthTheme.colors.text,
  ) {
    Box(contentAlignment = Alignment.Center) {
      Text(text = text, style = ZavorthTheme.type.label, color = ZavorthTheme.colors.text, maxLines = 1)
    }
  }
}

/** Circular icon badge used as a neutral leading marker in list rows. */
@Composable
internal fun ZavorthIconBadge(
  icon: ImageVector,
  modifier: Modifier = Modifier,
) {
  Surface(
    modifier = modifier.size(30.dp),
    shape = CircleShape,
    color = ZavorthTheme.colors.surfacePressed,
    border = BorderStroke(1.dp, ZavorthTheme.colors.border),
    contentColor = ZavorthTheme.colors.text,
  ) {
    Box(contentAlignment = Alignment.Center) {
      Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(14.dp), tint = ZavorthTheme.colors.text)
    }
  }
}

/** Reusable one-line list row with optional subtitle, metadata, slots, and click handling. */
@Composable
internal fun ZavorthListItem(
  title: String,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  metadata: String? = null,
  leading: (@Composable () -> Unit)? = null,
  trailing: (@Composable () -> Unit)? = null,
  onClick: (() -> Unit)? = null,
) {
  val rowModifier =
    if (onClick == null) {
      modifier
    } else {
      modifier.clickable(onClick = onClick)
    }

  Row(
    modifier =
      rowModifier
        .fillMaxWidth()
        .heightIn(min = ZavorthTheme.spacing.touchTarget)
        .clip(RoundedCornerShape(ZavorthTheme.radii.row))
        .padding(horizontal = 2.dp, vertical = 5.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(9.dp),
  ) {
    leading?.invoke()
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(
        text = title,
        style = ZavorthTheme.type.body,
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
    if (metadata != null) {
      Text(text = metadata, style = ZavorthTheme.type.caption, color = ZavorthTheme.colors.textSubtle, maxLines = 1)
    }
    trailing?.invoke()
  }
}

/** Equal-width segmented control for small mode/filter sets. */
@Composable
internal fun ZavorthSegmentedControl(
  options: List<String>,
  selected: String,
  onSelect: (String) -> Unit,
  modifier: Modifier = Modifier,
) {
  Row(
    modifier =
      modifier
        .clip(RoundedCornerShape(ZavorthTheme.radii.control))
        .border(1.dp, ZavorthTheme.colors.border, RoundedCornerShape(ZavorthTheme.radii.control))
        .padding(2.dp),
    horizontalArrangement = Arrangement.spacedBy(2.dp),
  ) {
    options.forEach { option ->
      val active = option == selected
      Box(
        modifier =
          Modifier
            .weight(1f)
            .clip(RoundedCornerShape(ZavorthTheme.radii.control))
            .background(if (active) ZavorthTheme.colors.primary else Color.Transparent)
            .clickable { onSelect(option) }
            .padding(horizontal = 9.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
      ) {
        Text(
          text = option,
          style = ZavorthTheme.type.caption,
          color = if (active) ZavorthTheme.colors.primaryText else ZavorthTheme.colors.textMuted,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

/** Token-styled text field used by settings and prototype screens. */
@Composable
internal fun ZavorthTextField(
  value: String,
  onValueChange: (String) -> Unit,
  placeholder: String,
  modifier: Modifier = Modifier,
  minLines: Int = 1,
) {
  BasicTextField(
    value = value,
    onValueChange = onValueChange,
    modifier =
      modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(ZavorthTheme.radii.control))
        .background(ZavorthTheme.colors.surfaceRaised)
        .border(1.dp, ZavorthTheme.colors.border, RoundedCornerShape(ZavorthTheme.radii.control))
        .padding(horizontal = 11.dp, vertical = 8.dp),
    textStyle = ZavorthTheme.type.body.copy(color = ZavorthTheme.colors.text),
    cursorBrush = SolidColor(ZavorthTheme.colors.primary),
    minLines = minLines,
    decorationBox = { innerTextField ->
      Box(modifier = Modifier.fillMaxWidth()) {
        if (value.isEmpty()) {
          Text(text = placeholder, style = ZavorthTheme.type.body, color = ZavorthTheme.colors.textSubtle)
        }
        innerTextField()
      }
    },
  )
}

/** Local design-system preview surface for visual smoke checks. */
@Composable
internal fun ZavorthComponentShowcase(modifier: Modifier = Modifier) {
  var selected by rememberSaveable { mutableStateOf("Chat") }
  var prompt by rememberSaveable { mutableStateOf("") }

  ZavorthScaffold(modifier = modifier) {
    Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
      ZavorthTopBar(
        title = "Zavorth",
        subtitle = "Local command center",
        navigation = { ZavorthAvatarMark(text = "OC") },
        actions = {
          ZavorthIconButton(icon = Icons.Default.Search, contentDescription = "Search", onClick = {})
        },
      )

      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text(text = "Zavorth", style = ZavorthTheme.type.display, color = ZavorthTheme.colors.text)
          Text(text = "Design system prototype", style = ZavorthTheme.type.body, color = ZavorthTheme.colors.textMuted)
        }
        ZavorthStatusPill(text = "Connected", status = ZavorthStatus.Success)
      }

      ZavorthSegmentedControl(
        options = listOf("Chat", "Voice", "Sessions"),
        selected = selected,
        onSelect = { selected = it },
        modifier = Modifier.fillMaxWidth(),
      )

      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        ZavorthSectionHeader(title = "Sessions")
        ZavorthListItem(
          title = "Testing testing 1 2 3",
          subtitle = "14 messages · Android",
          metadata = "now",
        )
        ZavorthListItem(
          title = "Provider setup",
          subtitle = "Zavorth gateway",
          metadata = "8m",
        )
      }

      ZavorthTextField(value = prompt, onValueChange = { prompt = it }, placeholder = "Ask Zavorth anything", minLines = 3)

      Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        ZavorthPrimaryButton(text = "Start Chat", onClick = {}, modifier = Modifier.weight(1f))
        ZavorthSecondaryButton(text = "Voice", onClick = {}, modifier = Modifier.weight(1f))
      }

      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        ZavorthPill(text = "Realtime", selected = true)
        ZavorthPill(text = "Dictation")
        ZavorthPill(text = "Screen")
      }

      ZavorthEmptyState(
        title = "Nothing needs your attention",
        body = "Zavorth will surface approvals, failed jobs, and channel issues here.",
      )

      ZavorthBottomNav(
        items =
          listOf(
            ZavorthNavItem(key = "overview", label = "Home", icon = Icons.Default.Home),
            ZavorthNavItem(key = "chat", label = "Chat", icon = Icons.Default.ChatBubble),
            ZavorthNavItem(key = "voice", label = "Voice", icon = Icons.Default.Mic),
            ZavorthNavItem(key = "settings", label = "Settings", icon = Icons.Default.Settings),
          ),
        selectedKey = "chat",
        onSelect = {},
      )
    }
  }
}
