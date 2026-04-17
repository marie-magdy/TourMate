@echo off
set "PATH=D:\Program Files;%PATH%"
cd /d "C:\Users\Malak\Desktop\grad project\TourMate\backend"
"D:\Program Files\node.exe" --env-file=.env src\index.js > "..\backend-run.log" 2> "..\backend-run.err.log"
