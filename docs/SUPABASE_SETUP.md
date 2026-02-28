# 🐺 DraftWolf: Supabase Setup Guide (Layman Terms)

Welcome! This guide will help you set up **Supabase** (your new login system) for DraftWolf. Think of Supabase as the "receptionist" that checks who is allowed to enter the app.

---

## Step 1: Create Your Supabase Account
1. Go to [Supabase.com](https://supabase.com/) and click **"Start your project"**.
2. Sign in with your GitHub account (it's the easiest way).
3. Click **"New Project"**.
4. Give your project a name (like `DraftWolf-App`) and set a database password (save this password somewhere safe!).
5. For the **Region**, pick the one closest to you.
6. Click **"Create new project"**. It will take a minute or two to "cook."

## Step 2: Get Your Secret "Keys"
Once your project is ready:
1. Look for the **"Settings"** icon (gear icon) on the left sidebar at the bottom.
2. Click **"API"**.
3. Under **"Project API keys"**, you will see two important things:
   - **Project URL**: Something like `https://xyz...supabase.co`
   - **anon public**: A long string of random letters.
4. Open your project folder on your computer and find the file named `.env`.
5. Paste them in like this:
   ```env
   VITE_SUPABASE_URL=paste_your_url_here
   VITE_SUPABASE_ANON_KEY=paste_your_anon_public_key_here
   ```

## Step 3: Set Up "Login with Google"
This lets users click a button to login with their Google account.
1. Go to the **"Authentication"** icon (user icon) on the left sidebar.
2. Click **"Providers"**.
3. Find **Google** in the list and click it.
4. Flip the switch to **"Enabled"**.
5. **Now, you need a "Client ID" and "Secret" from Google:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Click **"Create Project"** if you don't have one.
   - Search for **"APIs & Services"** > **"Credentials"**.
   - Click **"Create Credentials"** > **"OAuth client ID"**.
   - Choose **"Web application"**.
   - Under **"Authorized redirect URIs"**, add the URL that Supabase shows you in the Google provider settings (it usually looks like `https://...supabase.co/auth/v1/callback`).
   - Click **"Create"**. You'll get your **ID** and **Secret**.
6. Copy those back into the Supabase Google settings page and click **Save**.

## Step 4: Set Up "Login with Email"
This sends a "Magic Link" or code to the user's email.
1. In the same **"Providers"** list, find **Email**.
2. Make sure it's **Enabled**.
3. For now, turn **OFF** "Confirm email" if you want to test quickly without having to click a confirmation link every time.

## Step 5: Tell Supabase about your App
Supabase needs to know where to send the user back to after they login.
1. Go to **Authentication** > **URL Configuration**.
2. In **"Redirect URLs"**, add: `myapp://auth`
3. Click **"Add URL"**.

**That's it! Your app "receptionist" is now ready to work.** 🐺
