@echo off
title Create Desktop Shortcut - Science of Gifts
color 0A

echo ================================================================
echo    Creating Science of Gifts Desktop Shortcut
echo ================================================================
echo.

set "PROJECT_DIR=C:\Users\Datta\Videos\scienceofgifts"
if not exist "%PROJECT_DIR%" (
    set "PROJECT_DIR=%~dp0"
)

:: Strip trailing backslash if present
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

set "SCRIPT=%TEMP%\create_sog_shortcut.vbs"
set "TARGET=%PROJECT_DIR%\start-science-of-gifts.bat"
set "WORKDIR=%PROJECT_DIR%"
set "ICON=%PROJECT_DIR%\assets\icons\science-of-gifts.ico"

echo Target:           %TARGET%
echo WorkingDirectory: %WORKDIR%
echo Icon:             %ICON%
echo.

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SCRIPT%"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\Science of Gifts.lnk" >> "%SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SCRIPT%"
echo oLink.TargetPath = "%TARGET%" >> "%SCRIPT%"
echo oLink.WorkingDirectory = "%WORKDIR%" >> "%SCRIPT%"
echo oLink.Description = "Science of Gifts Local Content Editor" >> "%SCRIPT%"
echo oLink.IconLocation = "%ICON%,0" >> "%SCRIPT%"
echo oLink.Save >> "%SCRIPT%"

cscript /nologo "%SCRIPT%"
if exist "%SCRIPT%" del "%SCRIPT%"

echo.
echo ================================================================
echo   [SUCCESS] Shortcut "Science of Gifts" created on your Desktop!
echo   - Name:     Science of Gifts
echo   - Target:   %TARGET%
echo   - WorkDir:  %WORKDIR%
echo   - Icon:     %ICON%
echo ================================================================
echo.
pause
