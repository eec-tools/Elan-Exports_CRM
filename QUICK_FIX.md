# 🚨 IMMEDIATE FIX FOR CORS ERROR

## The Problem
Your frontend (Vercel) cannot talk to your backend (Render) because CORS is blocking it.

## The Solution (5 minutes)

### Step 1: Update Backend Environment on Render

1. Go to https://dashboard.render.com
2. Click on your backend service: `elan-exports-crm`
3. Click "Environment" in the left sidebar
4. Find or add `FRONTEND_URL` variable
5. Set value to: `https://elan-exports-crm.vercel.app`
6. Click "Save Changes"
7. Wait for automatic redeploy (2-3 minutes)

### Step 2: Verify It Works

1. Open: https://elan-exports-crm.onrender.com/api/health
2. You should see JSON with `"status": "ok"`
3. Check that `allowedOrigins` includes your Vercel URL

### Step 3: Test Your App

1. Go to: https://elan-exports-crm.vercel.app
2. Open browser DevTools (F12)
3. Try to login
4. CORS error should be gone!

## What Changed in Your Code

✅ Backend now supports multiple CORS origins (comma-separated)
✅ Added security headers for production
✅ Better error messages for CORS issues
✅ Enhanced health check endpoint
✅ Environment validation on startup

## If It Still Doesn't Work

### Check Backend Logs on Render

Look for this line when server starts:
```
🔒 Allowed origins: https://elan-exports-crm.vercel.app
```

If you see `localhost only`, the FRONTEND_URL variable isn't set correctly.

### Test CORS Manually

Run this in your terminal:
```bash
curl -H "Origin: https://elan-exports-crm.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  --verbose \
  https://elan-exports-crm.onrender.com/api/auth/login
```

You should see:
```
< Access-Control-Allow-Origin: https://elan-exports-crm.vercel.app
< Access-Control-Allow-Credentials: true
```

## Need Multiple Domains?

If you have multiple frontend URLs (staging, production, custom domain):

```env
FRONTEND_URL=https://elan-exports-crm.vercel.app,https://staging.vercel.app,https://yourdomain.com
```

## Commit Your Changes

```bash
git add .
git commit -m "fix: production CORS configuration and security improvements"
git push
```

Render will automatically redeploy when you push to your main branch.
