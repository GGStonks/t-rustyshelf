@echo off
rem Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
rem Build Boxshelf.exe.bat apart from the app's name ((T)rustyShelf).
cd /d "%~dp0"
echo Building a portable TrustyShelf.exe (first time downloads the packager, a few minutes)...
if not exist node_modules call npm install
call npm run dist
echo.
echo Done. Your exe is in the dist folder. Copy TrustyShelf.exe next to this file so it finds Dolphin, ROMS and themes.
pause
