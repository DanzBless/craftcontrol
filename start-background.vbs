Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c """ & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\start.bat""", 0, False
