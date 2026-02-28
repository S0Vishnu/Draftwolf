# 🐺 DraftWolf: Supabase Email Templates

Copy and paste these into your Supabase settings (**Authentication > Email Templates**).

---

## 1. Confirm Signup (Confirmation Email)

**Subject:**
Confirm your signup for DraftWolf 🐺

**Body:**
```html
<h2>Welcome to DraftWolf!</h2>
<p>Thanks for signing up. Please click the link below to confirm your account and start using the app:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your account</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
```

---

## 2. Magic Link (Login Email)

**Subject:**
Your DraftWolf Login Link 🐺

**Body:**
```html
<h2>DraftWolf Login</h2>
<p>Click the link below to sign in to your DraftWolf account:</p>
<p><a href="{{ .ConfirmationURL }}">Log In to DraftWolf</a></p>
<p>This link will expire in 24 hours.</p>
```

---

## 3. Change Email Address

**Subject:**
Confirm your new email for DraftWolf 🐺

**Body:**
```html
<h2>Email Change Request</h2>
<p>We received a request to change your email address. Please click the link below to verify your new email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm New Email</a></p>
```
