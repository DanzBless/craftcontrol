Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\start.bat"
WshShell.Run "cmd.exe /c """ & strPath & """", 0, False
