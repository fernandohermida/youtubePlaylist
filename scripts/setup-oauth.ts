import * as http from 'http';
import * as url from 'url';
import axios from 'axios';
import { config } from 'dotenv';

// Load environment variables from .env
config();

const CLIENT_ID = process.env.YOUTUBE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPE = 'https://www.googleapis.com/auth/youtube';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Error: OAuth credentials not found in .env file\n');
  console.error('Please add the following to your .env file:\n');
  console.error('YOUTUBE_OAUTH_CLIENT_ID=<your-client-id>');
  console.error('YOUTUBE_OAUTH_CLIENT_SECRET=<your-client-secret>\n');
  console.error('Get these from: https://console.cloud.google.com/apis/credentials\n');
  process.exit(1);
}

// Generate authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline', // Important: gets refresh token
  prompt: 'consent', // Force consent screen to ensure refresh token
})}`;

console.log('\n🔐 YouTube OAuth Setup\n');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('Step 1: Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('Step 2: Sign in with the Google account that owns the YouTube playlists\n');
console.log('Step 3: Grant permissions when prompted\n');
console.log('Step 4: You will be redirected back to localhost (waiting...)\n');

// Start local server to handle OAuth callback
const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const queryParams = url.parse(req.url, true).query;
  const code = queryParams.code as string;
  const error = queryParams.error as string;

  if (error) {
    console.error(`\n❌ OAuth error: ${error}\n`);
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>❌ Authentication Failed</h1>
          <p>Error: ${error}</p>
          <p>You can close this window and try again.</p>
        </body>
      </html>
    `);
    server.close();
    process.exit(1);
    return;
  }

  if (!code) {
    console.error('\n❌ No authorization code received\n');
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>❌ Error</h1>
          <p>No authorization code received</p>
          <p>You can close this window and try again.</p>
        </body>
      </html>
    `);
    server.close();
    process.exit(1);
    return;
  }

  try {
    console.log('\n✅ Authorization code received, exchanging for tokens...\n');

    // Exchange authorization code for tokens
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { refresh_token, access_token, expires_in } = response.data;

    if (!refresh_token) {
      console.error('\n❌ No refresh token received. This might happen if you\'ve already authorized this app.\n');
      console.error('To fix this, go to https://myaccount.google.com/permissions');
      console.error('Remove access for your app, then run this script again.\n');
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>⚠️ Warning</h1>
            <p>No refresh token received. This might happen if you've already authorized this app.</p>
            <p>To fix:</p>
            <ol>
              <li>Go to <a href="https://myaccount.google.com/permissions" target="_blank">https://myaccount.google.com/permissions</a></li>
              <li>Remove access for your app</li>
              <li>Run the setup script again</li>
            </ol>
            <p>You can close this window.</p>
          </body>
        </html>
      `);
      server.close();
      process.exit(1);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #4CAF50; }
            code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>✅ OAuth Setup Successful!</h1>
          <p>You can close this window and return to the terminal.</p>
          <p>Follow the instructions in the terminal to complete the setup.</p>
        </body>
      </html>
    `);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('✅ OAuth setup successful!\n');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('📝 Next Steps:\n');
    console.log('1. Add the following to your .env file for local testing:\n');
    console.log(`YOUTUBE_OAUTH_REFRESH_TOKEN=${refresh_token}\n`);
    console.log('2. Add these environment variables to Vercel:\n');
    console.log('   Run the following commands:\n');
    console.log(`   vercel env add YOUTUBE_OAUTH_CLIENT_ID`);
    console.log(`   (paste: ${CLIENT_ID})\n`);
    console.log(`   vercel env add YOUTUBE_OAUTH_CLIENT_SECRET`);
    console.log(`   (paste: ${CLIENT_SECRET})\n`);
    console.log(`   vercel env add YOUTUBE_OAUTH_REFRESH_TOKEN`);
    console.log(`   (paste: ${refresh_token})\n`);
    console.log('3. Remove the old API key (if it exists):\n');
    console.log('   vercel env rm YOUTUBE_API_KEY\n');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('ℹ️  Token Info:\n');
    console.log(`   Access token expires in: ${expires_in} seconds (~${Math.round(expires_in / 60)} minutes)`);
    console.log('   Refresh token: Valid indefinitely (until revoked)\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    server.close();
  } catch (error) {
    console.error('\n❌ Failed to exchange code for tokens:\n');
    if (axios.isAxiosError(error)) {
      console.error('Response:', error.response?.data);
    } else {
      console.error(error);
    }

    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>❌ Error</h1>
          <p>Failed to complete OAuth flow. Check the terminal for details.</p>
          <p>You can close this window.</p>
        </body>
      </html>
    `);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, () => {
  console.log('🌐 Local server started on http://localhost:3000\n');
  console.log('Waiting for OAuth callback...\n');
  console.log('💡 Tip: If the browser doesn\'t open automatically, copy and paste the URL above.\n');
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Setup cancelled by user\n');
  server.close();
  process.exit(0);
});
