#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print "Node.js is required. See README.md in this folder."
  read -k 1 "?Press any key to close."
  exit 1
fi
node scripts/open-local.mjs
if [[ $? -ne 0 ]]; then
  read -k 1 "?SUMMIT could not start. Press any key to close."
fi
