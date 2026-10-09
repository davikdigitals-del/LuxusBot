# Google sign-in setup

Google sign-in is a paid-first signup flow. A new Google user selects a plan and enters a workspace name, then goes to Kora checkout. The account is created only after the payment webhook verifies successful payment. Existing Google users sign in; users whose owned subscription is not active are sent to dashboard billing.

## Google Cloud

1. Create a **Web application** OAuth client ID in Google Cloud Console.
2. Add the website to **Authorized JavaScript origins**:
   - Production: `https://luxusbot-oo3c.onrender.com`
   - Local web development: `http://localhost:3001`
3. This integration uses Google Identity Services' popup credential flow. It does **not** use an OAuth redirect URI, so the Authorized redirect URIs list can remain empty.
4. Copy the OAuth client ID. Do not put the client secret in the browser or in Render's web-service variables.

## Render environment variables

Set the same public client ID on both Render services:

- **API service:** `GOOGLE_CLIENT_ID`
- **Web service:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

The web variable is embedded during the Next.js build, so save it and redeploy the web service after adding or changing it. The API verifies each Google credential against its own `GOOGLE_CLIENT_ID`.

The normal signup payment is unchanged: for a new Google account, enter the workspace name, choose a plan, and complete Kora checkout. No user or free workspace is created before payment succeeds.
