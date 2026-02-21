# 🚨 Security Notice

## Imgur Client ID Rotation Required

**Issue:** Imgur Client ID was accidentally hardcoded in commit `493eeff` and `7f96ab7`.

**Exposed Value:** `Client-ID 546c25a59c58ad7`

**Required Action:**
1. **Immediately rotate** the Imgur Client ID at https://imgur.com/account/settings/apps
2. **Set new Client ID** as Modal secret:
   ```bash
   modal secret create imgur-client-id IMGUR_CLIENT_ID=<new_client_id>
   ```
3. Deploy updated server (v1.4-imgur-secret-hardening)

**Timeline:**
- Exposed: 2026-02-22 01:03 UTC (commits 493eeff, 7f96ab7)
- Fixed: 2026-02-22 01:30 UTC (this commit)
- Rotation deadline: Within 24 hours

**Mitigation:**
- Hardcoded value removed from codebase
- ENV-based secret injection implemented
- Upload validation added (size/format limits)

**Note:** Git history cleanup is a separate task. Priority is rotating the exposed credential.
