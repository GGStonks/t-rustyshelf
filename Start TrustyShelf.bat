@echo off
rem Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is the same as Boxshelf's
rem Start Boxshelf.bat apart from the app's name ((T)rustyShelf).
cd /d "%~dp0"
if not exist node_modules (
  echo Installing ^(T^)rustyShelf the first time. This takes a minute...
  call npm install
)
call npm start
