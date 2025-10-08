#!/bin/bash
# Tool: system_info
# Description: Get system information

echo "{"
echo '  "platform": "'$(uname -s)'",'
echo '  "hostname": "'$(hostname)'",'
echo '  "current_dir": "'$(pwd)'",'
echo '  "user": "'$(whoami)'",'
echo '  "date": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"'
echo "}"
