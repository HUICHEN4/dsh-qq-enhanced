' 无窗口启动 PowerShell，避免多出一个空的 Windows Terminal 窗口
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = here
sh.Run """C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"" -NoProfile -ExecutionPolicy Bypass -STA -File """ & here & "\bridge-panel.ps1""", 0, False
