param([switch]$NoAutoStart)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Root    = 'D:\dsh-qq'
$LogDir  = Join-Path $Root 'state\logs'
$PanelLog = Join-Path $LogDir ('panel-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))
$null = New-Item -ItemType Directory -Force -Path $LogDir

# ───────────────────────── HTTP ─────────────────────────
function Get-Token {
  $f = Join-Path $Root 'state\control-center-token'
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() } else { return '' }
}
function Invoke-Cc([string]$method, [string]$path, $body = $null) {
  $headers = @{ 'x-control-token' = (Get-Token) }
  $uri = 'http://127.0.0.1:3099' + $path
  if ($null -ne $body) {
    $headers['content-type'] = 'application/json'
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 15
  }
  return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -TimeoutSec 15
}
function Get-State { try { return Invoke-Cc 'GET' '/api/state' } catch { return $null } }

# ───────────────────────── UI ─────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text = 'QQ 桥接'
$form.Size = New-Object System.Drawing.Size(1000, 640)
$form.MinimumSize = New-Object System.Drawing.Size(760, 480)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(24, 25, 30)
$form.ForeColor = [System.Drawing.Color]::FromArgb(210, 210, 215)
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 9)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Dock = 'Top'
$statusLabel.Height = 34
$statusLabel.TextAlign = 'MiddleLeft'
$statusLabel.Padding = New-Object System.Windows.Forms.Padding(12, 0, 0, 0)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(170, 175, 185)
$statusLabel.Text = '状态读取中…'
$form.Controls.Add($statusLabel)

$ctxLabel = New-Object System.Windows.Forms.Label
$ctxLabel.Dock = 'Top'
$ctxLabel.Height = 22
$ctxLabel.TextAlign = 'MiddleLeft'
$ctxLabel.Padding = New-Object System.Windows.Forms.Padding(12, 0, 0, 0)
$ctxLabel.Font = New-Object System.Drawing.Font('Microsoft YaHei UI', 8.5)
$ctxLabel.ForeColor = [System.Drawing.Color]::FromArgb(170, 175, 185)
$ctxLabel.Text = ''
$form.Controls.Add($ctxLabel)
$form.Controls.SetChildIndex($statusLabel, $form.Controls.Count - 1)

$btnBar = New-Object System.Windows.Forms.Panel
$btnBar.Dock = 'Top'
$btnBar.Height = 46
$btnBar.Padding = New-Object System.Windows.Forms.Padding(8, 6, 8, 6)
$form.Controls.Add($btnBar)

function New-Btn([string]$text, [int]$x, [int]$w, $back) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Left = $x; $b.Top = 6; $b.Width = $w; $b.Height = 32
  $b.FlatStyle = 'Flat'
  $b.FlatAppearance.BorderSize = 1
  $b.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(70, 72, 80)
  $b.BackColor = $back
  $b.ForeColor = [System.Drawing.Color]::FromArgb(235, 235, 240)
  $b.Cursor = [System.Windows.Forms.Cursors]::Hand
  return $b
}
$btnStart  = New-Btn '启动'        8    96 ([System.Drawing.Color]::FromArgb(45, 120, 78))
$btnStop   = New-Btn '停止并退出'  112  132 ([System.Drawing.Color]::FromArgb(150, 60, 60))
$btnOpen   = New-Btn '打开控制台'  252  116 ([System.Drawing.Color]::FromArgb(52, 58, 72))
$btnClear  = New-Btn '清屏'        376  72 ([System.Drawing.Color]::FromArgb(52, 58, 72))
$btnWeb    = New-Btn '网页控制台' 456  116 ([System.Drawing.Color]::FromArgb(52, 58, 72))
$btnBar.Controls.AddRange(@($btnStart, $btnStop, $btnOpen, $btnClear, $btnWeb))

$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Dock = 'Fill'
$logBox.ReadOnly = $true
$logBox.BackColor = [System.Drawing.Color]::FromArgb(16, 17, 20)
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(200, 200, 205)
$logBox.BorderStyle = 'None'
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9.5)
$logBox.WordWrap = $false
$logBox.HideSelection = $false
$logBox.DetectUrls = $false
$pad = New-Object System.Windows.Forms.Panel
$pad.Dock = 'Fill'
$pad.Padding = New-Object System.Windows.Forms.Padding(10, 4, 10, 10)
$pad.Controls.Add($logBox)
$form.Controls.Add($pad)
$pad.BringToFront()

# ───────────────────────── 日志 ─────────────────────────
function Ui-Log([string]$msg, [string]$kind = '') {
  $stamp = Get-Date -Format 'HH:mm:ss'
  $line = "[$stamp] $msg"
  switch ($kind) {
    'ok'   { $c = [System.Drawing.Color]::FromArgb(120, 205, 145) }
    'warn' { $c = [System.Drawing.Color]::FromArgb(232, 192, 110) }
    'err'  { $c = [System.Drawing.Color]::FromArgb(238, 120, 120) }
    'hl'   { $c = [System.Drawing.Color]::FromArgb(150, 190, 245) }
    default { $c = [System.Drawing.Color]::FromArgb(200, 200, 205) }
  }
  $script:logBox.SelectionStart = $script:logBox.TextLength
  $script:logBox.SelectionLength = 0
  $script:logBox.SelectionColor = $c
  $script:logBox.AppendText($line + "`r`n")
  $script:logBox.SelectionStart = $script:logBox.TextLength
  $script:logBox.ScrollToCaret()
  try { $line | Out-File -FilePath $PanelLog -Append -Encoding utf8 } catch { }
}

# 桥接日志跟随（增量读）
$script:tailPos = 0
$script:tailDay = ''
function Read-BridgeLogTail {
  $day = Get-Date -Format 'yyyyMMdd'
  $path = Join-Path $LogDir ("bridge-$day.log")
  if ($script:tailDay -ne $day) { $script:tailDay = $day; $script:tailPos = 0 }
  if (-not (Test-Path $path)) { return }
  try {
    $fs = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
  } catch { return }
  try {
    if ($fs.Length -lt $script:tailPos) { $script:tailPos = 0 }
    if ($fs.Length -eq $script:tailPos) { return }
    $null = $fs.Seek($script:tailPos, 'Begin')
    $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
    $text = $sr.ReadToEnd()
    $script:tailPos = $fs.Position
    $sr.Dispose()
    foreach ($raw in ($text -split "`r?`n")) {
      if (-not $raw.Trim()) { continue }
      # 去掉行首的 [ISO 时间] 前缀，只留本地 时:分:秒
      $ln = $raw -replace '^\[[0-9T:\-.]+Z\]\s*', ''
      $col = [System.Drawing.Color]::FromArgb(140, 142, 150)
      if ($ln -match '错误|失败|error|Error|异常|超时') { $col = [System.Drawing.Color]::FromArgb(232, 120, 120) }
      elseif ($ln -match '已连接|已就绪|已启动|采样完成|已更新') { $col = [System.Drawing.Color]::FromArgb(120, 200, 140) }
      $script:logBox.SelectionStart = $script:logBox.TextLength
      $script:logBox.SelectionLength = 0
      $script:logBox.SelectionColor = $col
      $script:logBox.AppendText('  ' + $ln + "`r`n")
      $script:logBox.SelectionStart = $script:logBox.TextLength
      $script:logBox.ScrollToCaret()
    }
  } catch { } finally { try { $fs.Dispose() } catch { } }
}

# ───────────────────────── 启动步骤机 ─────────────────────────
$script:steps = @(
  @{ name = '控制中心'; start = {
      if ($null -ne (Get-State)) { return 'skip' }
      $vbs = Join-Path $Root 'control-center-hidden.vbs'
      if (-not (Test-Path $vbs)) { throw "找不到 $vbs" }
      Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $vbs + '"') -WorkingDirectory $Root -WindowStyle Hidden
      return 'run'
    }; check = { $null -ne (Get-State) }; timeout = 45 },
  @{ name = 'NapCat'; start = {
      $st = Get-State
      if ($null -ne $st -and $st.napcat -and $st.napcat.running -eq $true) { return 'skip' }
      $null = Invoke-Cc 'POST' '/api/napcat/start' @{}
      return 'run'
    }; check = { $st = Get-State; $null -ne $st -and $st.napcat.running -eq $true }; timeout = 130 },
  @{ name = '桥接'; start = {
      $st = Get-State
      if ($null -ne $st -and $st.bridge -and $st.bridge.running -eq $true) { return 'skip' }
      $null = Invoke-Cc 'POST' '/api/bridge/start' @{}
      return 'run'
    }; check = { $st = Get-State; $null -ne $st -and $st.bridge.running -eq $true }; timeout = 100 },
  @{ name = 'QQ 在线'; start = { return 'wait' }; check = {
      $st = Get-State; if ($null -eq $st) { return $false }
      $b = $st.health.bridgeApi
      return ($null -ne $b -and $b.snowluma.connected -eq $true -and $b.snowluma.accountOnline -eq $true)
    }; timeout = 180 },
  @{ name = 'DSH 就绪'; start = { return 'wait' }; check = {
      $st = Get-State; if ($null -eq $st) { return $false }
      $b = $st.health.bridgeApi
      return ($null -ne $b -and $b.dshReady -eq $true)
    }; timeout = 120 }
)

$script:stepIdx = 0
$script:stepPhase = 'idle'
$script:stepDeadline = [DateTime]::MinValue
$script:startRunning = $false

function Start-Sequence {
  if ($script:startRunning) { return }
  $script:startRunning = $true
  $script:stepIdx = 0
  $script:stepPhase = 'start'
  $script:stepDeadline = [DateTime]::MinValue
  Ui-Log '=== 开始启动流程 ===' 'hl'
  $btnStart.Enabled = $false
}

function Step-Tick {
  if (-not $script:startRunning) { return }
  if ($script:stepIdx -ge $script:steps.Count) {
    $script:startRunning = $false
    $btnStart.Enabled = $true
    Ui-Log '=== 启动流程结束 ===' 'hl'
    return
  }
  $st = $script:steps[$script:stepIdx]

  if ($script:stepPhase -eq 'start') {
    try { $mode = & $st.start } catch {
      Ui-Log ($st.name + ' 启动失败：' + $_.Exception.Message) 'err'
      $script:startRunning = $false
      $btnStart.Enabled = $true
      return
    }
    if ($mode -eq 'skip') {
      Ui-Log ($st.name + '：已在运行，跳过') 'dim'
      $script:stepIdx++
      return
    }
    Ui-Log ($st.name + '：等待就绪…') 'warn'
    $script:stepDeadline = (Get-Date).AddSeconds($st.timeout)
    $script:stepPhase = 'wait'
    return
  }

  if ($script:stepPhase -eq 'wait') {
    $ok = $false
    try { $ok = [bool](& $st.check) } catch { $ok = $false }
    if ($ok) {
      Ui-Log ($st.name + '：就绪') 'ok'
      $script:stepPhase = 'start'
      $script:stepIdx++
      return
    }
    if ((Get-Date) -gt $script:stepDeadline) {
      $msg = "$($st.name)：超过 $($st.timeout) 秒未就绪"
      if ($st.name -eq 'NapCat') { $msg += '（可能要扫码，去控制台看二维码）' }
      if ($st.name -eq 'QQ 在线') { $msg += '（控制台看是不是要扫码）' }
      if ($st.name -eq 'DSH 就绪') { $msg += '（桥接在跑，但 @ 了不会有 AI 回）' }
      Ui-Log $msg 'err'
      $script:startRunning = $false
      $btnStart.Enabled = $true
    }
  }
}

# ───────────────────────── 停止 ─────────────────────────
function Stop-Everything {
  $btnStart.Enabled = $false
  $btnStop.Enabled = $false
  $script:startRunning = $false
  Ui-Log '=== 正在停止：桥接 → NapCat → 控制中心 ===' 'warn'
  foreach ($p in @('/api/bridge/stop', '/api/napcat/stop', '/api/platform/stop')) {
    try { $null = Invoke-Cc 'POST' $p @{}; Ui-Log ("$p 已发送") } catch { Ui-Log ("$p：" + $_.Exception.Message) 'warn' }
  }
  try { $null = Invoke-Cc 'POST' '/api/exit' @{}; Ui-Log '控制中心已退出' 'ok' } catch { Ui-Log ('控制中心退出：' + $_.Exception.Message) 'warn' }
  Ui-Log '窗口即将关闭（所有进程已停止）' 'hl'
  Start-Sleep -Milliseconds 1200
  $form.Close()
}

function Open-Console {
  $tok = Get-Token
  if ($tok) { $url = 'http://127.0.0.1:3099/#t=' + $tok } else { $url = 'http://127.0.0.1:3099' }
  try { Start-Process $url; Ui-Log '已打开控制台页面' 'dim' } catch { Ui-Log ('打开控制台失败：' + $_.Exception.Message) 'warn' }
}

# ───────────────────────── 上下文总量 ─────────────────────────
# 数据源：state/token-usage.jsonl 每步一行的 cacheMiss+cacheHit+cacheWrite ≈ 该步读入的上下文
# 增量读：记住上次读到的字节位置，只解析新追加的完整行；文件被压缩重写（变小）时整体重来。
# 整体重来只读尾部 1MB：每个会话只关心最近一条，不需要从头啃整个账本。
$script:ctxCache = @{ Pos = 0; Latest = @{} }
$script:ctxTailBytes = 1048576

function Get-ContextInfo {
  $path = Join-Path $Root 'state\token-usage.jsonl'
  if (-not (Test-Path $path)) { return @{ Text = '?'; Level = 0 } }
  try {
    $len = (New-Object System.IO.FileInfo($path)).Length
    if ($len -lt $script:ctxCache.Pos -or $len -eq 0) {
      $script:ctxCache.Pos = 0
      $script:ctxCache.Latest = @{}
    }
    if ($len -gt $script:ctxCache.Pos) {
      $startPos = $script:ctxCache.Pos
      $midFile = $false
      if ($startPos -eq 0 -and $len -gt $script:ctxTailBytes) {
        $startPos = $len - $script:ctxTailBytes
        $midFile = $true
      }
      $fs = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
      try {
        $null = $fs.Seek($startPos, 'Begin')
        $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8)
        $raw = $sr.ReadToEnd()
        $sr.Dispose()
      } finally { $fs.Dispose() }
      $body = $raw
      $consumed = ''
      if ($midFile) {
        $p = $body.IndexOf("`n")
        if ($p -lt 0) { $consumed = $body; $body = '' }
        else { $consumed = $body.Substring(0, $p + 1); $body = $body.Substring($p + 1) }
      }
      $nl = $body.LastIndexOf("`n")
      if ($nl -ge 0) {
        $consumed += $body.Substring(0, $nl + 1)
        $body = $body.Substring(0, $nl + 1)
      } else {
        $body = ''
      }
      $script:ctxCache.Pos = $startPos + [System.Text.Encoding]::UTF8.GetByteCount($consumed)
      foreach ($ln in ($body -split "`n")) {
        $ln = $ln.Trim()
        if (-not $ln) { continue }
        try { $o = $ln | ConvertFrom-Json } catch { continue }
        if ($o.k -ne 'turn' -or -not $o.key) { continue }
        $bb = $o.b
        if ($null -eq $bb) { continue }
        $ctx = [int]$bb.cacheMiss + [int]$bb.cacheHit + [int]$bb.cacheWrite
        if ($ctx -le 0) { continue }
        $script:ctxCache.Latest[$o.key] = $ctx
      }
    }
  } catch { return @{ Text = '?'; Level = 0 } }
  $latest = $script:ctxCache.Latest
  if ($latest.Count -eq 0) { return @{ Text = '--'; Level = 0 } }
  $rows = @()
  $maxLevel = 0
  foreach ($k in $latest.Keys) {
    $v = $latest[$k]
    $short = $k
    if ($short -match '^group:([0-9]+)$') { $short = '群' + $Matches[1] }
    elseif ($short -match '^private:([0-9]+)$') { $short = '私聊' + $Matches[1] }
    elseif ($short -match '^internal:(.+)$') { $short = $Matches[1] }
    $lv = 0
    if ($v -ge 130000) { $lv = 2 } elseif ($v -ge 100000) { $lv = 1 }
    if ($lv -gt $maxLevel) { $maxLevel = $lv }
    $rows += [pscustomobject]@{ Text = ($short + ' ' + [Math]::Round($v / 1000) + 'K'); K = [int]$v; Level = $lv }
  }
  $sorted = $rows | Sort-Object -Property K -Descending
  $maxShow = 6
  $parts = @()
  $i = 0
  foreach ($r in $sorted) {
    if ($i -ge $maxShow) { break }
    $parts += $r.Text
    $i++
  }
  $more = ''
  if ($sorted.Count -gt $maxShow) { $more = '  …+' + ($sorted.Count - $maxShow) }
  return @{ Text = ($parts -join '    ') + $more; Level = $maxLevel; Count = $sorted.Count }
}

# ───────────────────────── 状态栏 ─────────────────────────
function Update-Status {
  $st = Get-State
  if ($null -eq $st) { $script:statusLabel.Text = '控制中心：未运行'; return }
  $b = $st.health.bridgeApi
  $nm = 'NapCat ' + $(if ($st.napcat.running) { '✓' } else { '✗' })
  $bd = '桥接 ' + $(if ($st.bridge.running) { '✓' } else { '✗' })
  $qq = 'QQ ' + $(if ($null -ne $b -and $b.snowluma.accountOnline) { '✓' } else { '✗' })
  $dsh = 'DSH ' + $(if ($null -ne $b -and $b.dshReady) { '✓' } else { '✗' })
  $acct = ''
  if ($null -ne $b -and $null -ne $b.botAccount) { $acct = '  ' + $b.botAccount.nickname + '(' + $b.botAccount.userId + ')' }
  $script:statusLabel.Text = "控制中心 ✓    $nm    $bd    $qq    $dsh$acct"
  $ci = Get-ContextInfo
  $script:ctxLabel.Text = '上下文   ' + $ci.Text
  switch ($ci.Level) {
    2 { $c = [System.Drawing.Color]::FromArgb(238, 120, 120) }
    1 { $c = [System.Drawing.Color]::FromArgb(232, 192, 110) }
    default { $c = [System.Drawing.Color]::FromArgb(150, 156, 168) }
  }
  $script:ctxLabel.ForeColor = $c
}

# ───────────────────────── 事件 ─────────────────────────
$btnStart.Add_Click({ Start-Sequence })
$btnStop.Add_Click({
  $r = [System.Windows.Forms.MessageBox]::Show('确定要停止桥接 / NapCat / 控制中心并关闭本窗口吗？', '确认退出', 'YesNo', 'Question')
  if ($r -eq 'Yes') { Stop-Everything }
})
$btnOpen.Add_Click({ Open-Console })
$btnWeb.Add_Click({
  try { Start-Process 'http://127.0.0.1:3100'; Ui-Log '已打开网页控制台 http://127.0.0.1:3100' 'ok' } catch { Ui-Log ('打开网页控制台失败：' + $_.Exception.Message) 'err' }
})
$btnClear.Add_Click({ $script:logBox.Clear() })

$form.Add_Activated({
  if ($script:firstAct) { return }
  $script:firstAct = $true
  Update-Status
  Read-BridgeLogTail
  if (-not $NoAutoStart) { Start-Sequence }
})

$form.Add_FormClosing({ $script:uiTimer.Stop(); $script:stepTimer.Stop() })

$script:uiTimer = New-Object System.Windows.Forms.Timer
$script:uiTimer.Interval = 2000
$script:uiTimer.Add_Tick({ Update-Status; Read-BridgeLogTail })
$script:uiTimer.Start()

$script:stepTimer = New-Object System.Windows.Forms.Timer
$script:stepTimer.Interval = 800
$script:stepTimer.Add_Tick({ Step-Tick })
$script:stepTimer.Start()

$script:firstAct = $false
$script:statusLabel = $statusLabel
$script:logBox = $logBox

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BridgePanelWin {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@ -ErrorAction SilentlyContinue

$form.Add_Shown({
  # 用 -WindowStyle Hidden 启动时，WinForms 首窗会继承 SW_HIDE 而“隐身”；
  # 这里显式把主窗恢复出来并置前。
  try {
    $h = $form.Handle
    [void][BridgePanelWin]::ShowWindow($h, 5)   # SW_SHOW
    [void][BridgePanelWin]::ShowWindow($h, 9)   # SW_RESTORE
    [void][BridgePanelWin]::SetForegroundWindow($h)
    $form.Activate()
  } catch {
    Write-PanelLog ('显式显示窗口失败：' + $_.Exception.Message)
  }
  Ui-Log '窗口已启动（关闭本窗口不会停止桥接；要停用「停止并退出」）' 'dim'
})

[void]$form.ShowDialog()
