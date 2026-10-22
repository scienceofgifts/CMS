@echo off
title Science of Gifts - Launcher
color 0B

echo ================================================================
echo           SCIENCE OF GIFTS - LOCAL CONTENT SYSTEM
echo ================================================================
echo.

:: 1. Navigate to explicit project directory with fallback
set "PROJECT_DIR=C:\Users\Datta\Videos\scienceofgifts"
if not exist "%PROJECT_DIR%" (
    set "PROJECT_DIR=%~dp0"
)

echo [1/5] Setting project root: %PROJECT_DIR%
cd /d "%PROJECT_DIR%"

:: 2. Compile Tailwind CSS for the Jekyll site
echo [2/5] Building Tailwind CSS styles into assets/css/style.css...
call npm run build:css

:: 3. Start Jekyll server in its own visible CMD window
echo [3/5] Starting Jekyll website on http://localhost:4000/ ...
start "Science of Gifts - Jekyll" cmd /k "cd /d \"%PROJECT_DIR%\" && bundle exec jekyll serve --livereload --port 4000"

:: 4. Start CMS Content Editor in its own visible CMD window (using npm run editor)
echo [4/5] Starting Content Editor CMS on http://localhost:3000/ ...
start "Science of Gifts - CMS" cmd /k "cd /d \"%PROJECT_DIR%\" && npm run editor"

:: 5. Wait approximately 5 seconds for server initialization
echo [5/5] Waiting 5 seconds for servers to initialize...
timeout /t 5 /nobreak >nul

:: 6. Open CMS in default browser
echo Opening CMS at http://localhost:3000/ ...
start "" "http://localhost:3000/"

echo.
echo ================================================================
echo   Science of Gifts Local Content Studio is now running!
echo   - CMS Editor:      http://localhost:3000/
echo   - Jekyll Website:  http://localhost:4000/
echo.
echo   Both terminal windows ("Science of Gifts - Jekyll" and 
echo   "Science of Gifts - CMS") will remain open so you can 
echo   monitor real-time logs and output.
echo ================================================================
echo.
pause
