param([switch]$DryRun, [switch]$Quiet)

# 一键停止 QQ 桥接：桥接 → NapCat → SnowLuma → 控制中心
$ErrorActionPreference = 'Continue'
$Root   = 'D:\dsh-qq'
$LogDir = Join-Path $Root 'state\logs'
$null = New-Item -ItemType Directory -Force -Path $LogDir
$log = Join-Path $LogDir ('stop-{0}.log' -f (Get-Date -Format 'yyyyMMdd'))

function Say([string]$msg) {
  ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg) | Out-File -FilePath $log -Append -Encoding utf8
}

function Get-Token {
  $f = Join-Path $Root 'state\control-center-token'
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() } else { return '' }
}

function Invoke-Cc([string]$method, [string]$path) {
  $headers = @{ 'x-control-token' = (Get-Token); 'content-type' = 'application/json' }
  return Invoke-RestMethod -Method $method -Uri ('http://127.0.0.1:3099' + $path) -Headers $headers -Body '{}' -TimeoutSec 20
}

Say '=== 一键停止开始 ==='
$st = $null
try { $st = Invoke-RestMethod -Method 'GET' -Uri 'http://127.0.0.1:3099/api/state' -Headers @{ 'x-control-token' = (Get-Token) } -TimeoutSec 8 } catch { }

if ($null -eq $st) {
  Say '控制中心未运行：桥接大概率也已退出，无需操作'
  if ($DryRun) { Say 'DryRun：只检查，不动任何进程' }
  if (-not $Quiet) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show('控制中心没有在运行，桥接应该也已经停了。', 'QQ 桥接', 'OK', 'Information')
  }
  exit 0
}

$targets = @(
  @{ name = '桥接';     path = '/api/bridge/stop';   running = $st.bridge.running },
  @{ name = 'NapCat';   path = '/api/napcat/stop';   running = $st.napcat.running },
  @{ name = 'SnowLuma'; path = '/api/platform/stop'; running = $st.platform.running }
)

foreach ($t in $targets) {
  if ($DryRun) { Say ("DryRun：将停止 " + $t.name + "（running=" + $t.running + "）"); continue }
  try {
    $null = Invoke-Cc 'POST' $t.path
    Say ('已发送停止：' + $t.name)
  } catch {
    Say ('停止失败 ' + $t.name + '：' + $_.Exception.Message)
  }
}

if ($DryRun) {
  Say 'DryRun：将退出控制中心'
} else {
  try {
    $null = Invoke-Cc 'POST' '/api/exit'
    Say '已退出控制中心'
  } catch {
    Say ('退出控制中心失败：' + $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 1500
}

if (-not $Quiet) {
  Add-Type -AssemblyName System.Windows.Forms
  $text = if ($DryRun) { '检查完成，没有停止任何进程。' } else { '桥接、NapCat、控制中心已停止。' }
  [void][System.Windows.Forms.MessageBox]::Show($text, 'QQ 桥接', 'OK', 'Information')
}
Say '=== 结束 ==='
