# Gmail email delivery on Render

The API can send all application emails (password resets, invitations, and notifications) through Gmail's HTTPS API. This avoids relying on SMTP ports from Render and continues to send from the configured Gmail account.

## Google OAuth setup

1. In Google Cloud Console, create or select a project, enable the **Gmail API**, and configure the OAuth consent screen.
2. Create an OAuth client ID and client secret.
3. In Google OAuth Playground, open the settings, enable **Use your own OAuth credentials**, and enter that client ID and secret.
4. Authorize the scope `https://www.googleapis.com/auth/gmail.send` using the same Gmail account that will send Luxus Bot emails. Exchange the authorization code for tokens and copy the refresh token.
5. If the OAuth consent screen is in **Testing**, Google refresh tokens generally expire after seven days. Publish the consent screen (or use an appropriate Workspace internal app) for ongoing service use.

## Render API environment

Set these variables on the **API** service, then redeploy:

```env
EMAIL_PROVIDER=gmail-api
EMAIL_SMTP_USER=your-sending-account@gmail.com
EMAIL_FROM=Luxus Bot <your-sending-account@gmail.com>
GMAIL_API_CLIENT_ID=your-google-oauth-client-id
GMAIL_API_CLIENT_SECRET=your-google-oauth-client-secret
GMAIL_API_REFRESH_TOKEN=your-google-oauth-refresh-token
```

The `EMAIL_FROM` address must be the Gmail account authorized above or a sender alias already configured in that Gmail account. Keep the OAuth client secret and refresh token private; do not commit them or put them in frontend environment variables.

To return to SMTP, set `EMAIL_PROVIDER=smtp` and configure `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, and `EMAIL_SMTP_PASSWORD`.
