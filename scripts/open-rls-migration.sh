#!/bin/bash

# Script to help apply RLS migration
echo "════════════════════════════════════════════════════════════════"
echo "  OPENING RLS MIGRATION FILE AND SUPABASE DASHBOARD"
echo "════════════════════════════════════════════════════════════════"
echo ""

MIGRATION_FILE="supabase/migrations/005_create_rls_policies.sql"

# Check if file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"
echo "   File size: $(wc -l < "$MIGRATION_FILE") lines"
echo ""

# Open the file in default text editor
echo "📝 Opening migration file in your default editor..."
if command -v code &> /dev/null; then
    code "$MIGRATION_FILE"
    echo "   ✅ Opened in VS Code"
elif command -v notepad &> /dev/null; then
    notepad "$MIGRATION_FILE"
    echo "   ✅ Opened in Notepad"
else
    start "$MIGRATION_FILE"
    echo "   ✅ Opened in default editor"
fi

echo ""
echo "🌐 Opening Supabase Dashboard in your browser..."
start "https://supabase.com/dashboard"
echo "   ✅ Browser opened"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  NEXT STEPS:"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. In your editor:"
echo "   - Select ALL content (Ctrl+A)"
echo "   - Copy to clipboard (Ctrl+C)"
echo ""
echo "2. In Supabase Dashboard:"
echo "   - Select your Horizon project"
echo "   - Click 'SQL Editor' → 'New Query'"
echo "   - Paste the SQL (Ctrl+V)"
echo "   - Click 'Run' (or Ctrl+Enter)"
echo "   - Wait for 'Success. No rows returned' ✅"
echo ""
echo "3. Back in terminal, verify:"
echo "   npm run verify-rls"
echo ""
echo "════════════════════════════════════════════════════════════════"
