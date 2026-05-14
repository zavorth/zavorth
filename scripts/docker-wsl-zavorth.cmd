@echo off
setlocal

wsl.exe -d Ubuntu-24.04 -u root -- env DOCKER_HOST=unix:///var/run/docker-zavorth.sock docker %*
exit /b %ERRORLEVEL%
