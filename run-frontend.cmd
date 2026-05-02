@echo off
set "PATH=D:\Program Files;%PATH%"
cd /d "C:\Users\Malak\Desktop\grad project\TourMate\frontend"
"D:\Program Files\node.exe" node_modules\expo\bin\cli start -c --port 8081 > "..\frontend-run.log" 2> "..\frontend-run.err.log"
