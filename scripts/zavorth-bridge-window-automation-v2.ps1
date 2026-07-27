param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('focus', 'approve-visible-step', 'approve-visible-step-once', 'approve-visible-step-conversation', 'reject-visible-step', 'paste-and-submit', 'switch-model', 'verify-model', 'probe-surface', 'ensure-conversation-surface', 'reset-visible-conversation', 'read-latest-response', 'dump-visible-text')]
  [string]$Mode,

  [string]$WindowTitle = 'ZavorthBridge',

  [string]$Text = '',

  [int]$InitialDelayMs = 0,

  [int]$ProcessId = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing

$wshell = New-Object -ComObject WScript.Shell
$knownModels = @(
  'Gemini 3.1 Pro (High)',
  'Gemini 3.1 Pro (Low)',
  'Gemini 3 Flash',
  'Claude Sonnet 4.6 (Thinking)',
  'Claude Opus 4.6 (Thinking)',
  'GPT-OSS 120B (Medium)'
)
$primaryAllowedModels = @(
  'Gemini 3.1 Pro (High)',
  'Gemini 3.1 Pro (Low)',
  'Gemini 3 Flash'
)

$signature = @"
[DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
"@
Add-Type -MemberDefinition $signature -Name "MouseClick" -Namespace "Win32" -ErrorAction SilentlyContinue
$MOUSEEVENTF_LEFTDOWN = 0x02
$MOUSEEVENTF_LEFTUP = 0x04

function New-Diagnostics {
  return [ordered]@{
    foundModelButton = $false
    sentCtrlE = $false
    clickedElementName = $null
    clickedTargetElementName = $null
    homeScreenBefore = $null
    homeScreenAfter = $null
    hasInputBar = $false
    promptSurfaceReady = $false
    activeModelButton = $null
    verified = $false
    verifyMethod = $null
    matchedText = $null
  }
}

function Get-ElementName($Element) {
  if ($null -eq $Element) {
    return $null
  }

  try {
    return [string]$Element.Current.Name
  } catch {
    return $null
  }
}

function Test-ElementVisible($Element) {
  if ($null -eq $Element) {
    return $false
  }

  try {
    $rect = $Element.Current.BoundingRectangle
    return ($rect.Width -gt 2) -and ($rect.Height -gt 2)
  } catch {
    return $false
  }
}

function Get-ElementTop($Element) {
  if ($null -eq $Element) {
    return [double]::NegativeInfinity
  }

  try {
    return [double]$Element.Current.BoundingRectangle.Top
  } catch {
    return [double]::NegativeInfinity
  }
}

function Get-ElementBottom($Element) {
  if ($null -eq $Element) {
    return [double]::NegativeInfinity
  }

  try {
    return [double]$Element.Current.BoundingRectangle.Bottom
  } catch {
    return [double]::NegativeInfinity
  }
}

function Get-ElementArea($Element) {
  if ($null -eq $Element) {
    return 0
  }

  try {
    $rect = $Element.Current.BoundingRectangle
    return [double]($rect.Width * $rect.Height)
  } catch {
    return 0
  }
}

function Get-RuntimeIdKey($Element) {
  if ($null -eq $Element) {
    return ''
  }

  try {
    $runtimeId = $Element.GetRuntimeId()
    if ($null -eq $runtimeId) {
      return ''
    }

    return ($runtimeId | ForEach-Object { [string]$_ }) -join '-'
  } catch {
    return ''
  }
}

function Send-RepeatedKey([string]$KeyToken, [int]$Count) {
  for ($step = 0; $step -lt $Count; $step++) {
    [System.Windows.Forms.SendKeys]::SendWait($KeyToken)
    Start-Sleep -Milliseconds 120
  }
}

function Click-Element($Element) {
  if ($null -eq $Element) {
    return
  }

  $rect = $Element.Current.BoundingRectangle
  $x = [int]($rect.Left + ($rect.Width / 2))
  $y = [int]($rect.Top + ($rect.Height / 2))
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
  Start-Sleep -Milliseconds 100
  [Win32.MouseClick]::mouse_event($MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
  [Win32.MouseClick]::mouse_event($MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
}

function Activate-Element($Element) {
  if ($null -eq $Element) {
    return $false
  }

  try {
    $invokePattern = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    if ($invokePattern) {
      $invokePattern.Invoke()
      return $true
    }
  } catch {}

  try {
    $selectionPattern = $Element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    if ($selectionPattern) {
      $selectionPattern.Select()
      return $true
    }
  } catch {}

  try {
    $legacyPattern = $Element.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
    if ($legacyPattern) {
      $legacyPattern.DoDefaultAction()
      return $true
    }
  } catch {}

  Click-Element $Element
  return $true
}

function Get-ClickableElement($Element) {
  if ($null -eq $Element) {
    return $null
  }

  $current = $Element
  $currentArea = Get-ElementArea $Element
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker

  for ($depth = 0; $depth -lt 4; $depth++) {
    try {
      $parent = $walker.GetParent($current)
    } catch {
      $parent = $null
    }

    if ($null -eq $parent) {
      break
    }

    if (-not (Test-ElementVisible $parent)) {
      break
    }

    $parentArea = Get-ElementArea $parent
    if ($parentArea -gt ($currentArea + 25)) {
      return $parent
    }

    $current = $parent
  }

  return $Element
}

function Find-TargetProcess([int]$ExpectedPid, [string]$ExpectedTitle) {
  $targetProcess = $null
  $attempts = 0

  while ($attempts -lt 15 -and -not $targetProcess) {
    if ($ExpectedPid -gt 0) {
      $candidate = Get-Process -Id $ExpectedPid -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
      if ($candidate) {
        $targetProcess = $candidate
      }
    }

    if (-not $targetProcess) {
      $candidates = Get-Process | Where-Object {
        ($_.ProcessName -match 'ZavorthBridge' -or $_.MainWindowTitle -like "*$ExpectedTitle*") -and $_.MainWindowHandle -ne 0
      }

      if ($candidates) {
        $best = $candidates |
          Where-Object { $_.MainWindowTitle -like "*$ExpectedTitle*" } |
          Sort-Object StartTime -Descending |
          Select-Object -First 1

        if ($best) {
          $targetProcess = $best
        } else {
          $targetProcess = $candidates | Sort-Object StartTime -Descending | Select-Object -First 1
        }
      }
    }

    if (-not $targetProcess) {
      Start-Sleep -Seconds 1
      $attempts++
    }
  }

  return $targetProcess
}

function Activate-TargetWindow($TargetProcess) {
  $activated = $false

  try {
    [Microsoft.VisualBasic.Interaction]::AppActivate($TargetProcess.Id)
    $activated = $true
  } catch {
    Start-Sleep -Milliseconds 500
    try {
      $activated = $wshell.AppActivate($TargetProcess.MainWindowTitle)
    } catch {
      $activated = $false
    }
  }

  if (-not $activated) {
    throw "Could not activate ZavorthBridge window (PID $($TargetProcess.Id), Title '$($TargetProcess.MainWindowTitle)')."
  }
}

function Get-UiRoot($TargetProcess) {
  return [System.Windows.Automation.AutomationElement]::FromHandle($TargetProcess.MainWindowHandle)
}

function Find-FirstByName($Root, [string]$Name) {
  if ($null -eq $Root) {
    return $null
  }

  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $Name
  )
  return $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Find-AgentManagerEntryButton($Root) {
  $rootRect = Get-RootRect $Root
  foreach ($candidateName in @('Open Agent Manager', 'Switch to Agent Manager', 'Code with Agent')) {
    $matches = Find-AllByName $Root $candidateName
    if ($null -eq $matches) {
      continue
    }

    $matchCount = Get-CollectionCount $matches
    for ($index = 0; $index -lt $matchCount; $index++) {
      $candidate = Get-CollectionItem $matches $index
      if (-not (Test-ElementVisible $candidate)) {
        continue
      }

      if ($rootRect -and -not (Test-ElementWithinRoot $candidate $rootRect)) {
        continue
      }

      return $candidate
    }
  }

  return $null
}

function Find-AllByName($Root, [string]$Name) {
  if ($null -eq $Root) {
    return $null
  }

  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $Name
  )
  return $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Find-VisibleElementContaining($Root, [string[]]$Needles) {
  if ($null -eq $Root -or $null -eq $Needles -or $Needles.Count -eq 0) {
    return $null
  }

  $rootRect = Get-RootRect $Root
  if ($null -eq $rootRect) {
    return $null
  }

  $trueCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::IsEnabledProperty,
    $true
  )

  $allElements = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $trueCondition)
  if ($null -eq $allElements) {
    return $null
  }

  $best = $null
  $bestArea = 0
  $count = Get-CollectionCount $allElements
  for ($index = 0; $index -lt $count; $index++) {
    $element = Get-CollectionItem $allElements $index
    if (-not (Test-ElementVisible $element)) {
      continue
    }

    if (-not (Test-ElementWithinRoot $element $rootRect)) {
      continue
    }

    $name = Get-ElementName $element
    if ([string]::IsNullOrWhiteSpace($name)) {
      continue
    }

    $lowerName = $name.ToLowerInvariant()
    $matches = $true
    foreach ($needle in $Needles) {
      if ($lowerName -notlike "*$($needle.ToLowerInvariant())*") {
        $matches = $false
        break
      }
    }

    if (-not $matches) {
      continue
    }

    $area = Get-ElementArea $element
    if ($area -gt $bestArea) {
      $bestArea = $area
      $best = $element
    }
  }

  return $best
}

function Test-ElementWithinRoot($Element, $RootRect) {
  if ($null -eq $Element -or $null -eq $RootRect) {
    return $false
  }

  try {
    $rect = $Element.Current.BoundingRectangle
    $left = [Math]::Max([double]$rect.Left, [double]$RootRect.Left)
    $top = [Math]::Max([double]$rect.Top, [double]$RootRect.Top)
    $right = [Math]::Min([double]$rect.Right, [double]$RootRect.Right)
    $bottom = [Math]::Min([double]$rect.Bottom, [double]$RootRect.Bottom)
    return (($right - $left) -gt 6) -and (($bottom - $top) -gt 6)
  } catch {
    return $false
  }
}

function Get-RootRect($Root) {
  try {
    $rect = $Root.Current.BoundingRectangle
    $values = @(
      [double]$rect.Left,
      [double]$rect.Top,
      [double]$rect.Width,
      [double]$rect.Height
    )

    foreach ($value in $values) {
      if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) {
        return $null
      }
    }

    if ([double]$rect.Width -le 2 -or [double]$rect.Height -le 2) {
      return $null
    }

    return $rect
  } catch {
    return $null
  }
}

function Get-VisibleNamedElements($Root) {
  $results = @()
  if ($null -eq $Root) {
    return $results
  }

  $rootRect = Get-RootRect $Root
  if ($null -eq $rootRect) {
    return $results
  }

  $trueCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::IsEnabledProperty,
    $true
  )

  $elements = $Root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $trueCondition)
  if ($null -eq $elements) {
    return $results
  }

  $count = Get-CollectionCount $elements
  for ($index = 0; $index -lt $count; $index++) {
    $element = Get-CollectionItem $elements $index
    if (-not (Test-ElementVisible $element)) {
      continue
    }

    if (-not (Test-ElementWithinRoot $element $rootRect)) {
      continue
    }

    $name = Get-ElementName $element
    if ([string]::IsNullOrWhiteSpace($name)) {
      continue
    }

    try {
      $rect = $element.Current.BoundingRectangle
      $controlType = [string]$element.Current.ControlType.ProgrammaticName
      $results += [pscustomobject]@{
        Name = $name
        Left = [double]$rect.Left
        Top = [double]$rect.Top
        Right = [double]$rect.Right
        Bottom = [double]$rect.Bottom
        Width = [double]$rect.Width
        Height = [double]$rect.Height
        ControlType = $controlType
      }
    } catch {
      continue
    }
  }

  return $results
}

function Test-IsPermissionActionLabel([string]$Name) {
  $normalized = [string]$Name
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $false
  }

  return @(
    'Allow Once',
    'Allow This Conversation',
    'Allow',
    'Run Once',
    'Run',
    'Deny',
    'Reject'
  ) -contains $normalized
}

function Test-IsPermissionPromptText([string]$Name) {
  $normalized = [string]$Name
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return $false
  }

  if (Test-IsPermissionActionLabel $normalized) {
    return $false
  }

  $lowerName = $normalized.ToLowerInvariant()
  if (
    $lowerName -like 'allow file access to*' -or
    $lowerName -like 'allow directory access to*' -or
    $lowerName -like 'allow folder access to*' -or
    $lowerName -like 'allow workspace access to*' -or
    $lowerName -like 'allow access to*' -or
    $lowerName -like 'allow command*' -or
    $lowerName -like 'allow this command*' -or
    $lowerName -like 'run command*' -or
    $lowerName -like 'execute command*' -or
    $lowerName -like 'execute this command*' -or
    $lowerName -like 'permission required*' -or
    $lowerName -like 'permission request*'
  ) {
    return $true
  }

  return (
    ($lowerName -match '\b(allow|run|execute|permission)\b') -and
    ($lowerName -match '\b(file|folder|directory|workspace|access|command|terminal|shell|tool)\b')
  )
}

function Get-PermissionPromptSummary($Elements) {
  if ($null -eq $Elements) {
    return $null
  }

  $allNames = @($Elements | ForEach-Object { [string]$_.Name })
  $hasDeny = ($allNames -contains 'Deny') -or ($allNames -contains 'Reject')
  $hasAllowAction =
    ($allNames -contains 'Allow Once') -or
    ($allNames -contains 'Allow This Conversation') -or
    ($allNames -contains 'Allow') -or
    ($allNames -contains 'Run Once') -or
    ($allNames -contains 'Run')

  $candidates = @()
  foreach ($element in $Elements) {
    $name = [string]$element.Name
    if (-not (Test-IsPermissionPromptText $name)) {
      continue
    }
    $candidates += $element
  }

  if ((Get-CollectionCount $candidates) -gt 0) {
    $best = $candidates |
      Sort-Object @{
        Expression = { [double]$_.Top }
        Ascending = $true
      }, @{
        Expression = { -1 * [string]$_.Name.Length }
        Ascending = $true
      } |
      Select-Object -First 1

    if ($best) {
      return [string]$best.Name
    }
  }

  if ($hasDeny -and $hasAllowAction) {
    return 'Prompt visible with Allow/Deny buttons.'
  }

  return $null
}

function Test-IsPermissionPromptVisible($Elements) {
  $summary = Get-PermissionPromptSummary $Elements
  if (-not [string]::IsNullOrWhiteSpace($summary)) {
    return $true
  }

  foreach ($element in $Elements) {
    $name = [string]$element.Name
    if ($name -like 'Allow file access to*') {
      return $true
    }
  }

  $allNames = @($Elements | ForEach-Object { [string]$_.Name })
  return ($allNames -contains 'Allow Once' -or $allNames -contains 'Allow This Conversation') -and ($allNames -contains 'Deny')
}

function Get-ConversationTextCandidates($Root, $Elements) {
  $rootRect = Get-RootRect $Root
  if ($null -eq $rootRect) {
    return @()
  }

  $leftCutoff = $rootRect.Left + [Math]::Max(260, [Math]::Round($rootRect.Width * 0.18))
  $topCutoff = $rootRect.Top + 70
  $ignoredNames = @(
    'ZavorthBridge',
    'File',
    'Edit',
    'View',
    'Start new conversation',
    'Chat History',
    'Workspaces',
    'Open Folder',
    'Open Agent Manager',
    'Switch to Agent Manager',
    'Code with Agent',
    'Clone Repository',
    'Open editor',
    'Use Playground',
    'Planning',
    'Thinking...',
    'Generating...',
    'Processing Direct Request'
  ) + $knownModels

  $candidates = @()
  foreach ($element in $Elements) {
    $name = [string]$element.Name
    if ([string]::IsNullOrWhiteSpace($name)) {
      continue
    }

    if ([string]$element.ControlType -notlike '*Text') {
      continue
    }

    if ($element.Left -lt $leftCutoff -or $element.Top -lt $topCutoff) {
      continue
    }

    if ($ignoredNames -contains $name) {
      continue
    }

    if ($name -like '*ZAVORTH_DIRECT_PROMPT*' -or
        $name -like 'Correlation token:*' -or
        $name -like 'Workspace:*' -or
        $name -like 'Selected model:*' -or
        $name -like 'Use o modelo already active*' -or
        $name -like 'Do not mention these lines*' -or
        $name -like 'Refresh seus artefatos*' -or
        $name -like 'User request:*' -or
        $name -like 'Ask anything,*' -or
        $name -like 'Record voice memo*' -or
        $name -like 'Thought for *' -or
        $name -like 'Files Edited*' -or
        $name -like 'Progress Updates*' -or
        $name -like 'Initiating Prompt Response*' -or
        $name -like 'Initiating Artifact Generation*' -or
        $name -like 'Handling *' -or
        $name -like 'Refining *' -or
        $name -like 'Open Agent Manager*' -or
        $name -like 'Switch to Agent Manager*' -or
        $name -like 'Code with Agent*' -or
        $name -like 'Open Editor*' -or
        $name -like 'Scroll to bottom*' -or
        $name -eq '+' -or
        $name -eq 'Ctrl' -or
        $name -eq 'E' -or
        $name -eq 'L' -or
        $name -match '\.md$' -or
        $name -match '^[A-Za-z]:\\' -or
        $name -eq 'Thinking') {
      continue
    }

    $candidates += $element
  }

  return @($candidates | Sort-Object Top, Left)
}

function Get-GroupedTextBlocks($Candidates) {
  $blocks = @()
  if ((Get-CollectionCount $Candidates) -eq 0) {
    return $blocks
  }

  $currentItems = New-Object System.Collections.ArrayList
  $currentBottom = [double]::NegativeInfinity
  $seenNames = @{}

  foreach ($candidate in $Candidates) {
    $name = [string]$candidate.Name
    if ([string]::IsNullOrWhiteSpace($name)) {
      continue
    }

    $gap = if ([double]::IsNegativeInfinity($currentBottom)) { 0 } else { [double]$candidate.Top - $currentBottom }
    if ($currentItems.Count -gt 0 -and $gap -gt 28) {
      $blockText = @($currentItems | ForEach-Object { $_.Name }) -join "`n"
      $blocks += [pscustomobject]@{
        Top = $currentItems[0].Top
        Bottom = $currentBottom
        Text = $blockText
      }
      $currentItems = New-Object System.Collections.ArrayList
      $seenNames = @{}
    }

    if (-not $seenNames.ContainsKey($name)) {
      [void]$currentItems.Add($candidate)
      $seenNames[$name] = $true
      if ($candidate.Bottom -gt $currentBottom) {
        $currentBottom = [double]$candidate.Bottom
      }
    }
  }

  if ($currentItems.Count -gt 0) {
    $blockText = @($currentItems | ForEach-Object { $_.Name }) -join "`n"
    $blocks += [pscustomobject]@{
      Top = $currentItems[0].Top
      Bottom = $currentBottom
      Text = $blockText
    }
  }

  return $blocks
}

function Get-CollectionCount($Collection) {
  if ($null -eq $Collection) {
    return 0
  }

  try {
    return [int]$Collection.Count
  } catch {
    return 1
  }
}

function Get-CollectionItem($Collection, [int]$Index) {
  if ($null -eq $Collection) {
    return $null
  }

  try {
    return $Collection.Item($Index)
  } catch {
    if ($Index -eq 0) {
      return $Collection
    }

    return $null
  }
}

function Find-PermissionActionButton($Root, [string[]]$PreferredNames) {
  $rootRect = Get-RootRect $Root
  foreach ($candidateName in $PreferredNames) {
    $matches = Find-AllByName $Root $candidateName
    if ($null -eq $matches) {
      continue
    }

    $matchCount = Get-CollectionCount $matches
    for ($index = 0; $index -lt $matchCount; $index++) {
      $candidate = Get-CollectionItem $matches $index
      if (-not (Test-ElementVisible $candidate)) {
        continue
      }

      if ($rootRect -and -not (Test-ElementWithinRoot $candidate $rootRect)) {
        continue
      }

      return $candidate
    }
  }

  return $null
}

function Invoke-PermissionPromptAction($TargetProcess, [string[]]$PreferredNames, [string]$FallbackKeys) {
  $root = Get-UiRoot $TargetProcess
  $button = Find-PermissionActionButton $root $PreferredNames
  if ($button) {
    $clickedName = Get-ElementName $button
    $activated = Activate-Element $button
    if (-not $activated) {
      $clickableButton = Get-ClickableElement $button
      if ($null -ne $clickableButton) {
        if ([string]::IsNullOrWhiteSpace($clickedName)) {
          $clickedName = Get-ElementName $clickableButton
        }
        $activated = Activate-Element $clickableButton
      }
    }

    if ($activated) {
      Start-Sleep -Milliseconds 250
    }

    return [pscustomobject]@{
      Activated = [bool]$activated
      ClickedName = $clickedName
      FallbackUsed = $false
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($FallbackKeys)) {
    [System.Windows.Forms.SendKeys]::SendWait($FallbackKeys)
    Start-Sleep -Milliseconds 250
    return [pscustomobject]@{
      Activated = $true
      ClickedName = $null
      FallbackUsed = $true
    }
  }

  return [pscustomobject]@{
    Activated = $false
    ClickedName = $null
    FallbackUsed = $false
  }
}

function Test-HomeScreen($Root) {
  return $null -ne (Find-AgentManagerEntryButton $Root)
}

function Find-VisibleModelButton($Root) {
  $rootRect = Get-RootRect $Root
  $bestElement = $null
  $bestBottom = [double]::NegativeInfinity

  foreach ($modelName in $knownModels) {
    $matches = Find-AllByName $Root $modelName
    if ($null -eq $matches) {
      continue
    }

    $matchCount = Get-CollectionCount $matches
    for ($index = 0; $index -lt $matchCount; $index++) {
      $element = Get-CollectionItem $matches $index
      if (-not (Test-ElementVisible $element)) {
        continue
      }

      if ($rootRect -and -not (Test-ElementWithinRoot $element $rootRect)) {
        continue
      }

      $bottom = Get-ElementBottom $element
      if ($bottom -gt $bestBottom) {
        $bestBottom = $bottom
        $bestElement = $element
      }
    }
  }

  return $bestElement
}

function Focus-PromptInput($Root) {
  $inputElement = Find-VisibleElementContaining $Root @('Ask anything')
  if ($null -eq $inputElement) {
    $inputElement = Find-VisibleElementContaining $Root @('@ to mention')
  }

  if ($null -eq $inputElement) {
    return $null
  }

  Click-Element $inputElement
  Start-Sleep -Milliseconds 150
  Click-Element $inputElement
  Start-Sleep -Milliseconds 250
  return (Get-ElementName $inputElement)
}

function Click-StartNewConversation($Root) {
  $button = Find-VisibleElementContaining $Root @(
    'Start new conversation',
    'New conversation',
    'New chat'
  )
  if ($null -eq $button) {
    return $null
  }

  $clickable = Get-ClickableElement $button
  Activate-Element $clickable | Out-Null
  Start-Sleep -Milliseconds 900
  return (Get-ElementName $button)
}

function Find-TargetModelElement($Root, [string]$TargetName, $CurrentModelButton) {
  $currentRuntimeId = Get-RuntimeIdKey $CurrentModelButton
  $currentTop = Get-ElementTop $CurrentModelButton
  $deadline = (Get-Date).AddSeconds(3)

  while ((Get-Date) -lt $deadline) {
    $matches = Find-AllByName $Root $TargetName
    if ($null -ne $matches) {
      $preferred = $null
      $fallback = $null
      $preferredTop = [double]::NegativeInfinity

      $matchCount = Get-CollectionCount $matches
      for ($index = 0; $index -lt $matchCount; $index++) {
        $match = Get-CollectionItem $matches $index
        if (-not (Test-ElementVisible $match)) {
          continue
        }

        $runtimeId = Get-RuntimeIdKey $match
        if ($currentRuntimeId -and $runtimeId -eq $currentRuntimeId) {
          continue
        }

        $matchTop = Get-ElementTop $match
        if ($matchTop -lt ($currentTop - 4)) {
          if ($matchTop -gt $preferredTop) {
            $preferredTop = $matchTop
            $preferred = $match
          }
        } elseif ($null -eq $fallback) {
          $fallback = $match
        }
      }

      if ($preferred) {
        return $preferred
      }

      if ($fallback) {
        return $fallback
      }
    }

    Start-Sleep -Milliseconds 250
    $Root = Get-UiRoot $targetProcess
  }

  return $null
}

if ($InitialDelayMs -gt 0) {
  Start-Sleep -Milliseconds $InitialDelayMs
}

$targetProcess = Find-TargetProcess $ProcessId $WindowTitle
if (-not $targetProcess) {
  throw "ZavorthBridge window not found (no window with title '$WindowTitle' and handle appeared after 15s)."
}

Activate-TargetWindow $targetProcess
Start-Sleep -Milliseconds 350

$diagnostics = New-Diagnostics
$message = ''
$verified = $false

switch ($Mode) {
  'focus' {
    $message = 'ZavorthBridge window focused.'
  }

  'approve-visible-step' {
    $approval = Invoke-PermissionPromptAction $targetProcess @('Allow Once', 'Run Once', 'Allow') '%{ENTER}'
    if ($approval.ClickedName) {
      $diagnostics.clickedTargetElementName = $approval.ClickedName
    }
    $message = if ($approval.FallbackUsed) { 'Visible approval shortcut sent.' } else { 'Allow Once clicked.' }
  }

  'approve-visible-step-once' {
    $approval = Invoke-PermissionPromptAction $targetProcess @('Allow Once', 'Run Once', 'Allow') '%{ENTER}'
    if ($approval.ClickedName) {
      $diagnostics.clickedTargetElementName = $approval.ClickedName
    }
    $message = if ($approval.FallbackUsed) { 'Visible approval shortcut sent.' } else { 'Allow Once clicked.' }
  }

  'approve-visible-step-conversation' {
    $approval = Invoke-PermissionPromptAction $targetProcess @('Allow This Conversation', 'Allow Conversation') ''
    if (-not $approval.Activated) {
      throw "Could not find the 'Allow This Conversation' button in the ZavorthBridge permission prompt."
    }
    if ($approval.ClickedName) {
      $diagnostics.clickedTargetElementName = $approval.ClickedName
    }
    $message = 'Allow This Conversation clicked.'
  }

  'reject-visible-step' {
    $rejection = Invoke-PermissionPromptAction $targetProcess @('Deny', 'Reject') '{ESC}'
    if ($rejection.ClickedName) {
      $diagnostics.clickedTargetElementName = $rejection.ClickedName
    }
    $message = if ($rejection.FallbackUsed) { 'Visible rejection shortcut sent.' } else { 'Deny clicked.' }
  }

  'paste-and-submit' {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw 'Mode paste-and-submit requires non-empty Text.'
    }

    $root = Get-UiRoot $targetProcess
    if (Test-HomeScreen $root) {
      $entryButton = Find-AgentManagerEntryButton $root
      if ($entryButton) {
        $diagnostics.clickedElementName = Get-ElementName $entryButton
        Activate-Element (Get-ClickableElement $entryButton) | Out-Null
        Start-Sleep -Milliseconds 1200
        $root = Get-UiRoot $targetProcess
      }
    }

    $inputName = Focus-PromptInput $root
    if (-not $inputName) {
      throw 'Could not focus the ZavorthBridge prompt input before submitting the prompt.'
    }
    $diagnostics.clickedTargetElementName = $inputName

    Set-Clipboard -Value $Text
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('^v')
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    $message = 'Prompt pasted and submitted.'
  }

  'switch-model' {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw 'Mode switch-model requires non-empty Text (the model name).'
    }

    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    Start-Sleep -Milliseconds 300

    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenBefore = Test-HomeScreen $root

    if ($diagnostics.homeScreenBefore) {
      $agentManagerButton = Find-AgentManagerEntryButton $root
      if ($agentManagerButton) {
        $diagnostics.clickedElementName = Get-ElementName $agentManagerButton
        Activate-Element (Get-ClickableElement $agentManagerButton) | Out-Null
        Start-Sleep -Milliseconds 1200
        $root = Get-UiRoot $targetProcess
      }
    }

    $modelButton = Find-VisibleModelButton $root
    if (-not $modelButton) {
      $diagnostics.sentCtrlE = $true
      [System.Windows.Forms.SendKeys]::SendWait('^{e}')
      Start-Sleep -Milliseconds 1500
      $root = Get-UiRoot $targetProcess

      if (Test-HomeScreen $root) {
        $agentManagerButton = Find-AgentManagerEntryButton $root
        if ($agentManagerButton) {
          $existingClick = $diagnostics.clickedElementName
          $nextClick = Get-ElementName $agentManagerButton
          if ($existingClick) {
            $diagnostics.clickedElementName = "$existingClick -> $nextClick"
          } else {
            $diagnostics.clickedElementName = $nextClick
          }

          Activate-Element (Get-ClickableElement $agentManagerButton) | Out-Null
          Start-Sleep -Milliseconds 1200
          $root = Get-UiRoot $targetProcess
        }
      }

      $modelButton = Find-VisibleModelButton $root
    }

    if (-not $modelButton) {
      throw "Could not find any active model button (searched for $($knownModels -join ', '))."
    }

    $diagnostics.foundModelButton = $true
    $modelButtonName = Get-ElementName $modelButton
    if ($diagnostics.clickedElementName) {
      $diagnostics.clickedElementName = "$($diagnostics.clickedElementName) -> $modelButtonName"
    } else {
      $diagnostics.clickedElementName = $modelButtonName
    }

    if ($modelButtonName -eq $Text) {
      $diagnostics.clickedTargetElementName = $Text
      $message = "Target model already active: $Text."
    } else {
    Activate-Element (Get-ClickableElement $modelButton) | Out-Null
    Start-Sleep -Milliseconds 1000
    $root = Get-UiRoot $targetProcess

      $currentIndex = [Array]::IndexOf($primaryAllowedModels, $modelButtonName)
      $targetIndex = [Array]::IndexOf($primaryAllowedModels, $Text)

      if ($currentIndex -ge 0 -and $targetIndex -ge 0) {
        $steps = [Math]::Abs($targetIndex - $currentIndex)
        if ($steps -gt 0) {
          $keyToken = if ($targetIndex -gt $currentIndex) { '{DOWN}' } else { '{UP}' }
          Send-RepeatedKey $keyToken $steps
        }
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        $diagnostics.clickedTargetElementName = $Text
        Start-Sleep -Milliseconds 800
      } else {
        $targetElement = Find-TargetModelElement $root $Text $modelButton
        if ($targetElement) {
          $diagnostics.clickedTargetElementName = Get-ElementName $targetElement
          Activate-Element (Get-ClickableElement $targetElement) | Out-Null
          Start-Sleep -Milliseconds 800
        } else {
          throw "Target model '$Text' not found in the dropdown."
        }
      }
    }

    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenAfter = Test-HomeScreen $root
    if (-not $message) {
      $message = "Model switch attempted for $Text."
    }
  }

  'verify-model' {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw 'Mode verify-model requires non-empty Text (the model name).'
    }

    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    Start-Sleep -Milliseconds 300
    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenBefore = Test-HomeScreen $root
    $activeModelButton = Find-VisibleModelButton $root
    $activeModelName = Get-ElementName $activeModelButton
    $diagnostics.homeScreenAfter = Test-HomeScreen $root

    if ($activeModelName -eq $Text) {
      $verified = $true
      $diagnostics.verified = $true
      $diagnostics.verifyMethod = 'active-model-button'
      $diagnostics.matchedText = $activeModelName
      $message = "Active model button confirmed: $activeModelName."
    } else {
      $diagnostics.verified = $false
      $diagnostics.verifyMethod = 'not-confirmed'
      $diagnostics.matchedText = $activeModelName
      $message = "Active model button is '$activeModelName', not '$Text'."
    }
  }

  'probe-surface' {
    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenBefore = Test-HomeScreen $root
    $diagnostics.homeScreenAfter = $diagnostics.homeScreenBefore

    $activeModelButton = Find-VisibleModelButton $root
    $activeModelName = Get-ElementName $activeModelButton
    $diagnostics.activeModelButton = $activeModelName
    $diagnostics.matchedText = $activeModelName
    $diagnostics.hasInputBar = -not [string]::IsNullOrWhiteSpace($activeModelName)
    $diagnostics.promptSurfaceReady = (-not $diagnostics.homeScreenBefore) -and $diagnostics.hasInputBar
    $diagnostics.verified = $diagnostics.promptSurfaceReady
    $diagnostics.verifyMethod = 'surface-probe'
    $verified = $diagnostics.promptSurfaceReady

    if ($diagnostics.promptSurfaceReady) {
      $message = "Prompt surface ready with model '$activeModelName'."
    } elseif ($diagnostics.homeScreenBefore) {
      $message = 'ZavorthBridge is still showing the home screen.'
    } else {
      $message = 'ZavorthBridge prompt surface is not ready yet.'
    }
  }

  'ensure-conversation-surface' {
    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    Start-Sleep -Milliseconds 250

    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenBefore = Test-HomeScreen $root

    if ($diagnostics.homeScreenBefore) {
      $entryButton = Find-AgentManagerEntryButton $root
      if ($entryButton) {
        $diagnostics.clickedElementName = Get-ElementName $entryButton
        Activate-Element (Get-ClickableElement $entryButton) | Out-Null
        Start-Sleep -Milliseconds 1200
        $root = Get-UiRoot $targetProcess
      }
    }

    $activeModelButton = Find-VisibleModelButton $root
    if (-not $activeModelButton) {
      $diagnostics.sentCtrlE = $true
      [System.Windows.Forms.SendKeys]::SendWait('^{e}')
      Start-Sleep -Milliseconds 1000
      $root = Get-UiRoot $targetProcess

      if (Test-HomeScreen $root) {
        $entryButton = Find-AgentManagerEntryButton $root
        if ($entryButton) {
          $entryName = Get-ElementName $entryButton
          if ($diagnostics.clickedElementName) {
            $diagnostics.clickedElementName = "$($diagnostics.clickedElementName) -> $entryName"
          } else {
            $diagnostics.clickedElementName = $entryName
          }
          Activate-Element (Get-ClickableElement $entryButton) | Out-Null
          Start-Sleep -Milliseconds 1200
          $root = Get-UiRoot $targetProcess
        }
      }

      $activeModelButton = Find-VisibleModelButton $root
    }

    $activeModelName = Get-ElementName $activeModelButton
    $diagnostics.activeModelButton = $activeModelName
    $diagnostics.matchedText = $activeModelName
    $inputName = Focus-PromptInput $root
    if (-not $inputName) {
      $entryButton = Find-AgentManagerEntryButton $root
      if ($entryButton) {
        $entryName = Get-ElementName $entryButton
        if ($entryName) {
          if ($diagnostics.clickedElementName) {
            $diagnostics.clickedElementName = "$($diagnostics.clickedElementName) -> $entryName"
          } else {
            $diagnostics.clickedElementName = $entryName
          }
        }
        Activate-Element (Get-ClickableElement $entryButton) | Out-Null
        Start-Sleep -Milliseconds 900
        $root = Get-UiRoot $targetProcess
        $activeModelButton = Find-VisibleModelButton $root
        $activeModelName = Get-ElementName $activeModelButton
        if ($activeModelName) {
          $diagnostics.activeModelButton = $activeModelName
          $diagnostics.matchedText = $activeModelName
        }
        $inputName = Focus-PromptInput $root
      }
    }
    if ($inputName) {
      $diagnostics.clickedTargetElementName = $inputName
    } else {
      [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
      Start-Sleep -Milliseconds 300
      $root = Get-UiRoot $targetProcess
      $inputName = Focus-PromptInput $root
      if ($inputName) {
        $diagnostics.clickedTargetElementName = $inputName
      }
    }
    $diagnostics.hasInputBar = -not [string]::IsNullOrWhiteSpace($inputName)
    $diagnostics.homeScreenAfter = Test-HomeScreen $root
    $diagnostics.promptSurfaceReady = $diagnostics.hasInputBar
    $diagnostics.verified = $diagnostics.promptSurfaceReady
    $diagnostics.verifyMethod = 'ensure-conversation-surface:prompt-input'
    $verified = $diagnostics.promptSurfaceReady

    if ($diagnostics.promptSurfaceReady) {
      $message = "Conversation surface ready with prompt input '$inputName' and model '$activeModelName'."
    } elseif ($diagnostics.homeScreenAfter) {
      $message = 'ZavorthBridge remained on the home screen after recovery attempt.'
    } else {
      $message = 'ZavorthBridge conversation surface still not ready after recovery attempt.'
    }
  }

  'reset-visible-conversation' {
    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    Start-Sleep -Milliseconds 250

    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenBefore = Test-HomeScreen $root

    $beforeElements = Get-VisibleNamedElements $root
    $beforeCandidates = Get-ConversationTextCandidates $root $beforeElements
    $beforeBlocks = @(Get-GroupedTextBlocks $beforeCandidates)
    $beforeLatestBlock = if ((Get-CollectionCount $beforeBlocks) -gt 0) { Get-CollectionItem $beforeBlocks ((Get-CollectionCount $beforeBlocks) - 1) } else { $null }
    $beforeLatestText = if ($null -ne $beforeLatestBlock) { [string]$beforeLatestBlock.Text } else { '' }

    $clickedStart = Click-StartNewConversation $root
    if ($clickedStart) {
      $diagnostics.clickedElementName = $clickedStart
    }

    Start-Sleep -Milliseconds 700
    $root = Get-UiRoot $targetProcess
    $activeModelButton = Find-VisibleModelButton $root
    $activeModelName = Get-ElementName $activeModelButton
    $diagnostics.activeModelButton = $activeModelName
    $diagnostics.matchedText = $activeModelName

    $inputName = Focus-PromptInput $root
    if (-not $inputName) {
      [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
      Start-Sleep -Milliseconds 300
      $root = Get-UiRoot $targetProcess
      $inputName = Focus-PromptInput $root
    }
    if ($inputName) {
      $diagnostics.clickedTargetElementName = $inputName
    }

    $diagnostics.hasInputBar = -not [string]::IsNullOrWhiteSpace($inputName)
    $diagnostics.homeScreenAfter = Test-HomeScreen $root

    $elements = Get-VisibleNamedElements $root
    $candidates = Get-ConversationTextCandidates $root $elements
    $blocks = @(Get-GroupedTextBlocks $candidates)
    $latestBlock = if ((Get-CollectionCount $blocks) -gt 0) { Get-CollectionItem $blocks ((Get-CollectionCount $blocks) - 1) } else { $null }
    $latestText = if ($null -ne $latestBlock) { [string]$latestBlock.Text } else { '' }
    $diagnostics.matchedText = $latestText

    $responseCleared = [string]::IsNullOrWhiteSpace($latestText)
    $conversationChanged = $responseCleared -or ($latestText -ne $beforeLatestText)
    $diagnostics.promptSurfaceReady = $diagnostics.hasInputBar -and $conversationChanged
    $diagnostics.verified = $diagnostics.promptSurfaceReady
    $diagnostics.verifyMethod = 'reset-visible-conversation'
    $verified = $diagnostics.promptSurfaceReady

    if ($verified) {
      if ($responseCleared) {
        $message = 'Visible conversation reset confirmed in Manager.'
      } else {
        $message = 'Visible Manager conversation changed after reset.'
      }
    } elseif (-not $clickedStart) {
      $message = 'Could not find the visible Start new conversation button in Agent Manager.'
    } elseif (-not $diagnostics.hasInputBar) {
      $message = 'Agent Manager did not show the input bar after the reset attempt.'
    } else {
      $message = 'Manager conversation still shows previous response after reset attempt.'
    }
  }

  'read-latest-response' {
    $root = Get-UiRoot $targetProcess
    $diagnostics.homeScreenBefore = Test-HomeScreen $root
    $diagnostics.homeScreenAfter = $diagnostics.homeScreenBefore

    $activeModelButton = Find-VisibleModelButton $root
    $activeModelName = Get-ElementName $activeModelButton
    $diagnostics.activeModelButton = $activeModelName
    $diagnostics.matchedText = $activeModelName
    $diagnostics.hasInputBar = -not [string]::IsNullOrWhiteSpace($activeModelName)

    $elements = Get-VisibleNamedElements $root
    $permissionSummary = Get-PermissionPromptSummary $elements
    $permissionVisible = -not [string]::IsNullOrWhiteSpace($permissionSummary)
    $allNames = @($elements | ForEach-Object { [string]$_.Name })
    $hasGenerating = $allNames -contains 'Thinking...' -or $allNames -contains 'Generating...' -or $allNames -contains 'Processing Direct Request'
    $candidates = Get-ConversationTextCandidates $root $elements
    $blocks = @(Get-GroupedTextBlocks $candidates)
    $latestBlock = if ((Get-CollectionCount $blocks) -gt 0) { Get-CollectionItem $blocks ((Get-CollectionCount $blocks) - 1) } else { $null }
    $latestText = if ($null -ne $latestBlock) { [string]$latestBlock.Text } else { '' }

    if ($permissionVisible) {
      $verified = $false
      $diagnostics.verifyMethod = 'ui-read-permission-prompt'
      $diagnostics.matchedText = $permissionSummary
      $message = [ordered]@{
        ok = $true
        status = 'permission_prompt'
        hasPermissionPrompt = $true
        permissionPromptSummary = $permissionSummary
        hasInputBar = $diagnostics.hasInputBar
        visibleModel = $activeModelName
        responseText = ''
        confidence = 0.99
        notes = $(if ($permissionSummary) { "Permission prompt visible in ZavorthBridge UI: $permissionSummary" } else { 'Permission prompt visible in ZavorthBridge UI.' })
      } | ConvertTo-Json -Compress
      break
    }

    if ($hasGenerating -and [string]::IsNullOrWhiteSpace($latestText)) {
      $verified = $false
      $diagnostics.verifyMethod = 'ui-read-generating'
      $message = [ordered]@{
        ok = $true
        status = 'generating'
        hasPermissionPrompt = $false
        hasInputBar = $diagnostics.hasInputBar
        visibleModel = $activeModelName
        responseText = ''
        confidence = 0.92
        notes = 'ZavorthBridge is still generating and no assistant response block is visible yet.'
      } | ConvertTo-Json -Compress
      break
    }

    if (-not [string]::IsNullOrWhiteSpace($latestText)) {
      $verified = -not $hasGenerating
      $diagnostics.verifyMethod = 'ui-read-latest-block'
      $diagnostics.matchedText = $latestText
      $message = [ordered]@{
        ok = $true
        status = $(if ($hasGenerating) { 'generating' } else { 'ready' })
        hasPermissionPrompt = $false
        hasInputBar = $diagnostics.hasInputBar
        visibleModel = $activeModelName
        responseText = $latestText
        confidence = $(if ($hasGenerating) { 0.75 } else { 0.94 })
        notes = 'Latest visible assistant block read from UI Automation.'
      } | ConvertTo-Json -Compress
      break
    }

    $verified = $false
    $diagnostics.verifyMethod = 'ui-read-no-response'
    $message = [ordered]@{
      ok = $true
      status = 'unknown'
      hasPermissionPrompt = $false
      hasInputBar = $diagnostics.hasInputBar
      visibleModel = $activeModelName
      responseText = ''
      confidence = 0.25
      notes = 'No visible assistant response block found in the current ZavorthBridge conversation.'
    } | ConvertTo-Json -Compress
  }

  'dump-visible-text' {
    $root = Get-UiRoot $targetProcess
    $elements = Get-VisibleNamedElements $root | Sort-Object Top, Left
    $payload = [ordered]@{
      ok = $true
      count = @($elements).Count
      elements = @($elements | Select-Object -First 250)
    } | ConvertTo-Json -Depth 6 -Compress
    $message = $payload
  }
}

$payload = [ordered]@{
  ok = $true
  mode = $Mode
  windowTitle = $targetProcess.MainWindowTitle
  pid = $targetProcess.Id
  textLength = $message.Length
  message = $message
  verified = $verified
  diagnostics = $diagnostics
}

$payload | ConvertTo-Json -Compress -Depth 6
