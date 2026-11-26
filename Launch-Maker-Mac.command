#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Please install Node.js 22 LTS from https://nodejs.org/"
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d "node_modules/tsx" ]; then
  echo "First-time setup: installing dependencies..."
  if ! npm install; then
    echo "Retrying install with --legacy-peer-deps..."
    npm install --legacy-peer-deps
  fi
fi

open_app_window() {
  local url="http://localhost:3000"
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args --app="$url" --start-maximized
  elif [ -d "/Applications/Microsoft Edge.app" ]; then
    open -na "Microsoft Edge" --args --app="$url" --start-maximized
  else
    open "$url"
  fi
}

if curl -fsS "http://localhost:3000" >/dev/null 2>&1; then
  echo "Maker Studio is already running at http://localhost:3000. Opening standalone app window..."
  open_app_window
  exit 0
fi

echo "Starting Maker Studio on http://localhost:3000 ..."
echo "Keep this window open while using the app. Close it to stop the server."
echo ""

(
  for _ in $(seq 1 60); do
    if curl -fsS "http://localhost:3000" >/dev/null 2>&1; then
      open_app_window
      break
    fi
    sleep 0.5
  done
) &

npm run dev
