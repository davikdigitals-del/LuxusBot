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

## GitHub and Discord sign-in

GitHub and Discord sign-in are also available on the login and registration pages. Configure these values on the **API service**:

```env
API_URL=https://luxus-api.onrender.com
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

Set the API origin on the **web service** too, so the sign-in buttons start OAuth on the API:

```env
NEXT_PUBLIC_API_URL=https://luxus-api.onrender.com
```

Redeploy the web service after setting this variable because Next.js embeds it into the production build.

Register these exact OAuth callback URLs with each provider:

- GitHub: `https://luxus-api.onrender.com/api/auth/github/callback`
- Discord: `https://luxus-api.onrender.com/api/auth/discord/callback`

For local development, use `http://localhost:3000/api/auth/github/callback` and `http://localhost:3000/api/auth/discord/callback`; set `API_URL=http://localhost:3000` and `NEXT_PUBLIC_API_URL=http://localhost:3000`.

GitHub OAuth needs the `read:user` and `user:email` scopes; Discord needs `identify` and `email`. Both providers must return a verified email address. Existing accounts can use GitHub or Discord after the verified provider email matches the account email. New social signups still require choosing a paid plan and completing checkout; payment success creates the account. After changing API environment variables, redeploy the API service.
