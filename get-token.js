const { JWT } = require('google-auth-library');
const serviceAccount = require('./service-account.json');

const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

async function getAccessToken() {
  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: SCOPES,
  });
  const tokens = await client.authorize();
  const token = tokens.access_token || tokens.token;
  console.log("\n==== SEU ACCESS TOKEN ====\n");
  console.log(token); // <-- COPIE ESTE VALOR!
  console.log("\n==========================\n");
}

getAccessToken();
