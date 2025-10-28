# Deploying to Vercel

## Option 1: Deploy via Vercel CLI (Quickest)

### Prerequisites
1. Install Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```

2. Make sure your project is initialized with Git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

### Deploy Steps

1. **Login to Vercel:**
   ```bash
   vercel login
   ```
   This will open a browser window for authentication.

2. **Deploy to production:**
   ```bash
   vercel --prod
   ```
   
   Follow the prompts:
   - **Set up and deploy?** → Yes
   - **Which scope?** → Select your account
   - **Link to existing project?** → No (first time) or Yes (if updating)
   - **Project name?** → Press Enter for default or type a name
   - **Directory?** → `./` (current directory)
   - **Override settings?** → No (defaults are fine)

3. **Your app will be live!** 
   Vercel will provide you with a URL like: `https://your-project-name.vercel.app`

---

## Option 2: Deploy via GitHub (Recommended for continuous deployment)

### Prerequisites
1. Create a GitHub account if you don't have one
2. Create a new repository on GitHub (e.g., `horse-racing-matchups`)

### Deploy Steps

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Import to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click **"Add New..."** → **"Project"**
   - Click **"Import Git Repository"**
   - Select your GitHub repository
   - Click **"Import"**

3. **Configure Project:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (leave as is)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

4. **Deploy:**
   - Click **"Deploy"**
   - Wait for build to complete (2-3 minutes)
   - Your app is live!

5. **Future Updates:**
   - Just push to GitHub and Vercel automatically deploys
   - Every push to `main` branch = production deployment

---

## Option 3: Deploy via Vercel Dashboard (No CLI)

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **"Add New..."** → **"Project"**
3. If you have GitHub connected:
   - Select your repository
   - Click **"Import"**
4. If you don't have GitHub:
   - Install Vercel CLI
   - Run `vercel` in your project directory
   - Follow the prompts

---

## Important Notes

### JSON Files Location
Your JSON files (`v0_BAQ_ext.json`, etc.) are in the `public/` folder, which is perfect for Vercel. They'll be accessible at:
- `https://your-app.vercel.app/v0_BAQ_ext.json`
- `https://your-app.vercel.app/v0_GP_ext.json`
- etc.

### Environment Variables (if needed later)
If you add environment variables:
1. Go to your project on Vercel dashboard
2. Settings → Environment Variables
3. Add your variables

### Custom Domain (Optional)
1. Go to your project on Vercel dashboard
2. Settings → Domains
3. Add your custom domain

### Sharing the Demo
Once deployed, share the Vercel URL:
- `https://your-app.vercel.app`
- Each visitor gets their own localStorage session
- Perfect for demos and testing!

---

## Troubleshooting

**Build fails?**
- Make sure all dependencies are in `package.json`
- Check that `next.config.js` doesn't have `output: 'export'` (we removed it)
- Look at build logs in Vercel dashboard

**JSON files not loading?**
- Ensure files are in `public/` folder
- Check browser console for 404 errors
- Verify file paths in your code match the public folder structure

**Need to restart?**
```bash
vercel --prod
```

---

## Quick Commands Reference

```bash
# First time setup
vercel login
vercel

# Production deployment
vercel --prod

# View deployments
vercel ls

# View logs
vercel logs

# Remove deployment
vercel remove
```

