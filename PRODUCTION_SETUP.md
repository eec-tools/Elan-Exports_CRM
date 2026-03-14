# Production Setup Guide - Élan Exports CRM

## 🚨 CORS Issue - IMMEDIATE FIX

The CORS error occurs because your backend needs to allow your Vercel frontend domain.

### Backend Environment Variables (Render.com)

Add these environment variables in Render dashboard:

```env
NODE_ENV=production
FRONTEND_URL=https://elan-exports-crm.vercel.app,http://localhost:5173
DATABASE_URL=your-neon-postgres-url
JWT_SECRET=your-secure-256-bit-secret
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_EMAIL=your-email@gmail.com
SMTP_APP_PASSWORD=your-app-password
PORT=3001
```

### Frontend Environment Variables (Vercel)

Add these in Vercel project settings:

```env
VITE_API_URL=https://elan-exports-crm.onrender.com/api
```

## 📋 Deployment Checklist

### Backend (Render.com)

1. ✅ Set all environment variables above
2. ✅ Ensure build command: `npm install && npm run build`
3. ✅ Ensure start command: `npm start`
4. ✅ Redeploy after setting FRONTEND_URL
5. ✅ Check logs for "Allowed origins" message

### Frontend (Vercel)

1. ✅ Set VITE_API_URL environment variable
2. ✅ Redeploy after backend is configured
3. ✅ Test login functionality


## 🔒 Security Improvements Applied

- ✅ Multi-origin CORS support with comma-separated URLs
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ Trust proxy configuration for Render/Vercel
- ✅ Stricter rate limiting in production (100 req/15min)
- ✅ Graceful shutdown handlers
- ✅ CORS preflight caching (10 minutes)
- ✅ Explicit allowed methods and headers

## 🚀 Quick Fix Steps

### Step 1: Update Backend Environment on Render

1. Go to Render dashboard → Your backend service
2. Navigate to "Environment" tab
3. Add/Update: `FRONTEND_URL=https://elan-exports-crm.vercel.app`
4. Click "Save Changes"
5. Wait for automatic redeploy

### Step 2: Verify Backend

Visit: `https://elan-exports-crm.onrender.com/api/health`

Should return: `{"status":"ok","timestamp":"..."}`

### Step 3: Test Frontend

1. Clear browser cache
2. Visit: `https://elan-exports-crm.vercel.app`
3. Try logging in

## 🐛 Troubleshooting

### CORS Still Blocked?

Check backend logs on Render:
- Look for "Allowed origins:" message on startup
- Look for "CORS blocked origin:" warnings

### 401 Unauthorized?

- Check JWT_SECRET is set on backend
- Verify DATABASE_URL is correct
- Check if user exists in database

### 500 Server Error?

- Check all environment variables are set
- Verify database connection
- Check SMTP credentials if email-related

## 📊 Monitoring

### Backend Health Check
```bash
curl https://elan-exports-crm.onrender.com/api/health
```

### Check CORS Headers
```bash
curl -H "Origin: https://elan-exports-crm.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  --verbose \
  https://elan-exports-crm.onrender.com/api/auth/login
```

Should see:
- `Access-Control-Allow-Origin: https://elan-exports-crm.vercel.app`
- `Access-Control-Allow-Credentials: true`

## 🔐 Additional Production Recommendations

### 1. Database
- ✅ Using Neon PostgreSQL (good choice)
- Consider enabling connection pooling
- Set up automated backups

### 2. Secrets Management
- Rotate JWT_SECRET regularly
- Use strong SMTP app passwords
- Never commit .env files

### 3. Monitoring
- Set up Render alerts for downtime
- Monitor API response times
- Track error rates

### 4. Performance
- Consider adding Redis for session management
- Implement database query optimization
- Add response compression

### 5. Logging
- Implement structured logging (Winston/Pino)
- Set up error tracking (Sentry)
- Monitor API usage patterns

## 📝 Environment Variable Reference

### Required Backend Variables
| Variable | Description | Example |
|----------|-------------|---------|
| NODE_ENV | Environment mode | `production` |
| FRONTEND_URL | Allowed CORS origins (comma-separated) | `https://app.vercel.app` |
| DATABASE_URL | PostgreSQL connection string | `postgresql://...` |
| JWT_SECRET | Secret for JWT signing | `256-bit-random-string` |
| JWT_EXPIRES_IN | Token expiration | `7d` |
| SMTP_HOST | Email server | `smtp.gmail.com` |
| SMTP_PORT | Email port | `465` |
| SMTP_EMAIL | Sender email | `your@email.com` |
| SMTP_APP_PASSWORD | Email app password | `xxxx-xxxx-xxxx-xxxx` |
| PORT | Server port | `3001` |

### Required Frontend Variables
| Variable | Description | Example |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | `https://api.render.com/api` |

## ✅ Post-Deployment Verification

1. Backend health check returns 200
2. Frontend loads without console errors
3. Login works successfully
4. API calls complete without CORS errors
5. File uploads work (if applicable)
6. Email notifications send (if applicable)

## 🆘 Need Help?

If issues persist:
1. Check Render logs for backend errors
2. Check Vercel logs for frontend errors
3. Verify all environment variables are set correctly
4. Test API endpoints directly with curl/Postman
5. Check database connectivity
