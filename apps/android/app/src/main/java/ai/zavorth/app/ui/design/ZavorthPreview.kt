package dev.zavorth.companion.ui.design

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview

@Preview(
  name = "Zavorth Design System",
  showBackground = true,
  backgroundColor = 0xFF030303,
)
@Composable
private fun ZavorthComponentShowcasePreview() {
  // Preview uses the design-system theme directly so token regressions show up in isolation.
  ZavorthDesignTheme {
    ZavorthComponentShowcase()
  }
}
