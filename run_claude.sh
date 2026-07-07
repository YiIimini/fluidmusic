#!/bin/bash
export PATH="/Users/x/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd /Users/x/Documents/Codex/FluidMusic
exec 1> .claude-cli.log 2>&1
echo "=== CLAUDE CLI START $(date) ==="
echo "Prompt: $(wc -c < .claude-prompt.txt) bytes"
echo "Working dir: $(pwd)"
claude -p "$(cat .claude-prompt.txt)" --allow-dangerously-skip-permissions
echo "=== CLAUDE CLI END $(date) ==="
