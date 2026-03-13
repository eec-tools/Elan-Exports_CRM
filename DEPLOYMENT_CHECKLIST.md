# 📋 Production Deployment Checklist

## ✅ Pre-Deployment

### Backend (Render.com)
- [ ] All environment variables set in Render dashboard
- [ ] `FRONTEND_URL` includes Vercel domain
- [ ] `NODE_ENV=production` is set
- [ ] Database URL is correct and accessible
- [ ] JWT_SECRET is strong and secure (256-bit)
- [ ] SMTP credentials are valid
- [ ] Build command: `cd backend && npm install && npm run build`
- [ ] Start command: `cd backend && npm start`
- [ ] Health check path: `/api/health`

### Frontend (Vercel)
- [ ] `VITE_API_URL` points to Render backend
- [ ] Build command: `cd frontend && npm run build`
- [ ] Output directory: `frontend/dist`
- [ ] Node version : 20.x

### Database (Neon)
- [ ] Connection pooling enabled
- [ ] Migrations applied
- [ ] Seed data loaded (if needed)
- [ ] Backups configured

## ✅ Post-Deployment

### Backend Verification
- [ ] Health check returns 200: `https://elan-exports-crm.onrender.com/api/health`
- [ ] Response includes correct `allowedOrigins`
- [ ] Database status shows "connected"
- [ ] No errors in Render logs
- [ ] CORS headers present in OPTIONS requests

### Frontend Verification
- [ ] Site loads: `https://elan-exports-crm.vercel.app`
- [ ] No console errors
- [ ] Login works
- [ ] API calls succeed
- [ ] No CORS errors

### Functional Testing
- [ ] User authentication works
- [ ] Dashboard loads data
- [ ] CRUD operations work
- [ ] File uploads work (if applicable)
- [ ] Email notifications send (if applicable)
- [ ] All pages accessible
- [ ] Mobile responsive

## ✅ Security Checklist

- [ ] HTTPS enabled on both frontend and backend
- [ ] CORS properly configured
- [ ] Rate limiting active
- [ ] Security headers present
- [ ] JWT tokens expire appropriately
- [ ] Passwords hashed with bcrypt
- [ ] No sensitive data in logs
- [ ] Environment variables not committed
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection enabled

## ✅ Performance Checklist

- [ ] API response times < 500ms
- [ ] Frontend loads < 3 seconds
- [ ] Images optimized
- [ ] Database queries optimized
- [ ] Connection pooling configured
- [ ] Rate limiting prevents abuse

## ✅ Monitoring Setup

- [ ] Render alerts configured
- [ ] Vercel analytics enabled
- [ ] Error tracking setup (optional: Sentry)
- [ ] Uptime monitoring (optional: UptimeRobot)
- [ ] Log aggregation (optional: Papertrail)

## 🚨 Rollback Plan

If deployment fails:

1. Revert environment variables in Render
2. Redeploy previous version from Git
3. Check database migrations
4. Verify frontend build
5. Test health endpoint

## 📞 Support Contacts

- Render Support: https://render.com/support
- Vercel Support: https://vercel.com/support
- Neon Support: https://neon.tech/docs/introduction

## 📝 Post-Deployment Tasks

- [ ] Update documentation
- [ ] Notify team of deployment
- [ ] Monitor for 24 hours
- [ ] Schedule next deployment
- [ ] Review and optimize based on metrics
