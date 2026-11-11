# QQ 桥接一键启动（带监控窗口）：控制中心 → NapCat → 桥接 → 实时日志
$ErrorActionPreference = 'Stop'
$root = 'D:\dsh-qq'
$logDir = Join-Path $root 'state\logs'
$null = New-Item -ItemType Directory -Force -Path $logDir
$log = Join-Path $logDir ('autostart-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))

try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }
try { $Host.UI.RawUI.WindowTitle = 'QQ 桥接启动 / 监控' } catch { }

function Say([string]$msg, [string]$color = 'Gray') {
  $stamp = Get-Date -Format 'HH:mm:ss'
  Write-Host ("[{0}] {1}" -f $stamp, $msg) -ForegroundColor $color
  try { ("[{0}] {1}" -f $stamp, $msg) | Out-File -FilePath $log -Append -Encoding utf8 } catch { }
}

function Get-Token {
  $f = Join-Path $root 'state\control-center-token'
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() } else { return '' }
}

function Invoke-Api([string]$method, [string]$path, $body = $null) {
  $headers = @{ 'x-control-token' = (Get-Token) }
  $uri = 'http://127.0.0.1:3099' + $path
  if ($null -ne $body) {
    $headers['content-type'] = 'application/json'
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 25
  }
  return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -TimeoutSec 25
}

function Get-State {
  try { return Invoke-Api 'GET' '/api/state' } catch { return $null }
}

function Get-Bot {
  $st = Get-State
  if ($null -eq $st) { return $null }
  try { return $st.health.bridgeApi } catch { return $null }
}

function Test-QqOnline {
  $bot = Get-Bot
  if ($null -eq $bot -or $null -eq $bot.snowluma) { return $false }
  return ($bot.snowluma.connected -eq $true -and $bot.snowluma.accountOnline -eq $true)
}

function Wait-Console([int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if ($null -ne (Get-State)) { return $true }
    Start-Sleep -Milliseconds 700
  }
  return $false
}

function Wait-Running([string]$name, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    $st = Get-State
    if ($null -ne $st) {
      $v = $null
      try { $v = $st.$name.running } catch { }
      if ($v -eq $true) { return $true }
    }
    Start-Sleep -Milliseconds 800
  }
  return $false
}

function Wait-QqOnline([int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-QqOnline) { return $true }
    Write-Host '.' -NoNewline -ForegroundColor DarkGray
    Start-Sleep -Milliseconds 1500
  }
  return $false
}

Write-Host ''
Say '=== QQ 桥接一键启动 ===' 'Cyan'

try {
  # 1) 控制中心
  if ($null -ne (Get-State)) {
    Say '控制中心已在运行（127.0.0.1:3099）' 'DarkGray'
  } else {
    Say '启动控制中心…' 'Yellow'
    $vbs = Join-Path $root 'control-center-hidden.vbs'
    if (-not (Test-Path $vbs)) { throw "找不到 $vbs" }
    Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + $vbs + '"') -WorkingDirectory $root -WindowStyle Hidden
    if (-not (Wait-Console 40)) { throw '控制中心 40 秒内没有起来（3099 无响应）' }
    Say '控制中心已就绪' 'Green'
  }

  # 2) NapCat
  $st = Get-State
  if ($st.napcat -and $st.napcat.running -eq $true) {
    Say 'NapCat 已在运行，跳过' 'DarkGray'
  } else {
    Say '启动 NapCat（快速登录）…' 'Yellow'
    $null = Invoke-Api 'POST' '/api/napcat/start' @{}
    if (-not (Wait-Running 'napcat' 120)) { throw 'NapCat 120 秒内没有起来（可能快速登录失效，需要手动扫码）' }
    Say 'NapCat 进程已起' 'Green'
  }

  # 3) 桥接
  $st = Get-State
  if ($st.bridge -and $st.bridge.running -eq $true) {
    Say '桥接已在运行，跳过' 'DarkGray'
  } else {
    Say '启动桥接…' 'Yellow'
    $null = Invoke-Api 'POST' '/api/bridge/start' @{}
    if (-not (Wait-Running 'bridge' 90)) { throw '桥接 90 秒内没有起来（详见 state\logs\bridge-*.log）' }
    Say '桥接进程已起' 'Green'
  }

  # 4) 等 QQ 在线
  Say '等待 QQ 登录完成（最多 150 秒）' 'Yellow'
  if (Wait-QqOnline 150) {
    Write-Host ''
    $bot = Get-Bot
    $who = ''
    if ($null -ne $bot -and $null -ne $bot.botAccount) { $who = ' ' + $bot.botAccount.nickname + '（' + $bot.botAccount.userId + '）' }
    Say ('QQ 已在线' + $who) 'Green'
  } else {
    Write-Host ''
    Say 'QQ 150 秒内未确认在线：去控制台看看是不是要扫码' 'Red'
  }

  # 5) DSH 是否就绪
  $bot = Get-Bot
  if ($null -ne $bot -and $bot.dshReady -ne $true) {
    Say 'DSH 未就绪：桥接在跑，但 @ 了不会有 AI 回' 'Red'
  } elseif ($null -ne $bot) {
    Say 'DSH 已就绪，AI 可以被唤醒' 'Green'
  }

  Say '启动流程结束，打开控制台页面' 'Cyan'
  # 页面用 #t=<令牌> 免输令牌，直接进控制台
  $pageToken = Get-Token
  if ($pageToken) { $pageUrl = 'http://127.0.0.1:3099/#t=' + $pageToken } else { $pageUrl = 'http://127.0.0.1:3099' }
  Say ('控制台地址（已带令牌，可直接复制到浏览器）：' + $pageUrl) 'Cyan'
  Start-Process $pageUrl

  Write-Host ''
  Write-Host ('=' * 68) -ForegroundColor DarkGray
  Write-Host '  下面是桥接实时日志（关掉本窗口不影响桥接运行，Ctrl+C 停止监控）' -ForegroundColor Cyan
  Write-Host ('=' * 68) -ForegroundColor DarkGray
  Write-Host ''

  $bridgeLog = Join-Path $logDir ('bridge-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))
  if (Test-Path $bridgeLog) {
    Get-Content -Path $bridgeLog -Tail 15 -Wait -Encoding UTF8
  } else {
    Say ('没找到今天的桥接日志：' + $bridgeLog) 'Red'
  }
} catch {
  Write-Host ''
  Say ('启动失败：' + $_.Exception.Message) 'Red'
  Say ('详细日志：' + $log) 'DarkGray'
  Write-Host ''
  Write-Host '按回车关闭本窗口（桥接进程不受影响）…' -ForegroundColor Yellow
  $null = Read-Host
}
