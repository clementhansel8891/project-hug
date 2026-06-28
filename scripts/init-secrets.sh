#!/bin/bash
# ============================================================================
# Initialize Docker Secrets
# Run this once on the VPS to set up secrets files from environment variables.
# Usage: bash scripts/init-secrets.sh
# ============================================================================

set -e

SECRETS_DIR="$(dirname "$0")/../secrets"
mkdir -p "$SECRETS_DIR"

echo "🔒 Initializing Docker Secrets..."

# Generate secure defaults if not provided via env
DB_USER="${POSTGRES_USER:-zenvix}"
DB_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -base64 24)}"
JWT_SECRET_VAL="${JWT_SECRET:-$(openssl rand -base64 48)}"
STRIPE_KEY="${STRIPE_SECRET_KEY:-sk_test_placeholder}"
STRIPE_WEBHOOK="${STRIPE_WEBHOOK_SECRET:-whsec_placeholder}"

echo -n "$DB_USER" > "$SECRETS_DIR/db_user.txt"
echo -n "$DB_PASSWORD" > "$SECRETS_DIR/db_password.txt"
echo -n "$JWT_SECRET_VAL" > "$SECRETS_DIR/jwt_secret.txt"
echo -n "$STRIPE_KEY" > "$SECRETS_DIR/stripe_secret_key.txt"
echo -n "$STRIPE_WEBHOOK" > "$SECRETS_DIR/stripe_webhook_secret.txt"

# Lock down permissions
chmod 600 "$SECRETS_DIR"/*.txt
chmod 700 "$SECRETS_DIR"

echo "✅ Secrets initialized at $SECRETS_DIR/"
echo "   db_user.txt          → $DB_USER"
echo "   db_password.txt      → ****"
echo "   jwt_secret.txt       → ****"
echo "   stripe_secret_key.txt → ${STRIPE_KEY:0:10}..."
echo "   stripe_webhook_secret.txt → ${STRIPE_WEBHOOK:0:10}..."
echo ""
echo "⚠️  IMPORTANT: These files contain production secrets."
echo "   - They are git-ignored (check .gitignore)"
echo "   - Back them up securely"
echo "   - Never commit them to version control"
