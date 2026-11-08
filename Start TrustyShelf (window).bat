@echo off
rem Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
rem Start Boxshelf (window).bat apart from the app's name ((T)rustyShelf).
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run windowed
