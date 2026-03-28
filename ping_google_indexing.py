#!/usr/bin/env python3
"""
Ping Google Search Console Indexing API for a newly published blog post URL.
Requires GOOGLE_INDEXING_SA_JSON env var containing the service account JSON key.

Usage:
  python ping_google_indexing.py <slug>
  python ping_google_indexing.py 2026-03-28-nvidia-narrative-trap

The script will request indexing for:
  https://marketprism.co/blog/<slug>
"""

import json
import os
import sys
import time


def get_access_token(sa_info: dict) -> str:
    """Get OAuth2 access token from service account credentials using JWT."""
    import hashlib
    import hmac
    import base64
    import urllib.request

    now = int(time.time())
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=")
    payload = base64.urlsafe_b64encode(json.dumps({
        "iss": sa_info["client_email"],
        "scope": "https://www.googleapis.com/auth/indexing",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }).encode()).rstrip(b"=")

    # Sign with RSA - requires cryptography or PyJWT
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        private_key = serialization.load_pem_private_key(
            sa_info["private_key"].encode(), password=None
        )
        signature = private_key.sign(
            header + b"." + payload,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=")
    except ImportError:
        print("  ! cryptography package not installed — skipping indexing ping")
        return ""

    jwt_token = (header + b"." + payload + b"." + sig_b64).decode()

    # Exchange JWT for access token
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={jwt_token}".encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read())["access_token"]


def ping_indexing_api(url: str, access_token: str) -> dict:
    """Request Google to index or update the given URL."""
    import urllib.request

    body = json.dumps({"url": url, "type": "URL_UPDATED"}).encode()
    req = urllib.request.Request(
        "https://indexing.googleapis.com/v3/urlNotifications:publish",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
    )
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read())


def main():
    if len(sys.argv) < 2:
        print("Usage: python ping_google_indexing.py <slug>")
        sys.exit(1)

    slug = sys.argv[1]
    page_url = f"https://marketprism.co/blog/{slug}"

    sa_json = os.environ.get("GOOGLE_INDEXING_SA_JSON", "")
    if not sa_json:
        print(f"  ⚠ GOOGLE_INDEXING_SA_JSON not set — skipping indexing ping for {page_url}")
        sys.exit(0)

    try:
        sa_info = json.loads(sa_json)
    except json.JSONDecodeError:
        print("  ⚠ GOOGLE_INDEXING_SA_JSON is not valid JSON — skipping")
        sys.exit(0)

    print(f"  → Requesting Google indexing for: {page_url}")

    try:
        token = get_access_token(sa_info)
        if not token:
            sys.exit(0)
        result = ping_indexing_api(page_url, token)
        print(f"  ✓ Indexing API response: {json.dumps(result)}")
    except Exception as e:
        print(f"  ⚠ Indexing API ping failed (non-fatal): {e}")
        sys.exit(0)


if __name__ == "__main__":
    main()
