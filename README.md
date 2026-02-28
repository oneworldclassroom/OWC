# One World Classroom — Deployment Guide

> Complete website deployment via GitHub Pages. Free hosting, automatic deploys, custom domain ready.

---

## File Structure

```
owc-deploy/
├── index.html              ← Student platform (main site)
├── admin/
│   └── index.html          ← Admin control panel (password protected)
├── js/
│   └── owc-data.js         ← Shared data layer (connects platform ↔ admin)
├── .github/
│   └── workflows/
│       └── deploy.yml      ← Auto-deploy on every GitHub push
└── README.md               ← This file
```

---

## Step 1 — Create a GitHub Account

1. Go to **https://github.com**
2. Click **Sign up** — use your email address
3. Verify your email

---

## Step 2 — Create a New Repository

1. Click the **+** icon (top right) → **New repository**
2. Repository name: `oneworldclassroom` (or any name you like)
3. Set to **Public** ← required for free GitHub Pages
4. Leave everything else as default
5. Click **Create repository**

---

## Step 3 — Upload Your Files

### Option A — GitHub Web Interface (easiest, no software needed)

1. On your new repo page, click **uploading an existing file**
2. Drag and drop these files/folders:
   - `index.html`
   - `admin/` folder (drag the whole folder)
   - `js/` folder
   - `.github/` folder
   - `README.md`
3. Write a commit message: `Initial deployment`
4. Click **Commit changes**

> ⚠️ **Important:** When uploading the `.github/workflows/deploy.yml` file via the web interface, you must manually create the folder path. Go to: Add file → Create new file → type `.github/workflows/deploy.yml` and paste the contents of `deploy.yml`.

### Option B — Git Command Line (recommended for ongoing updates)

```bash
# Install Git if you don't have it: https://git-scm.com/downloads

git init
git add .
git commit -m "Initial OWC deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/oneworldclassroom.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 4 — Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar, under "Code and automation")
4. Under **Source**, select **GitHub Actions**
5. Click **Save**

The first deployment will start automatically. It takes about **1–2 minutes**.

---

## Step 5 — Access Your Live Website

After deployment, your site is live at:

```
https://YOUR_USERNAME.github.io/oneworldclassroom/
```

- **Student Platform:** `https://YOUR_USERNAME.github.io/oneworldclassroom/`
- **Admin Panel:** `https://YOUR_USERNAME.github.io/oneworldclassroom/admin/`

---

## Step 6 — Admin Panel Login

Default credentials:
- **Password:** `owcadmin2025`

> 🔒 **Change your password immediately after first login:**
> Go to Admin → Settings → Security → Change Admin Password

---

## Step 7 — Custom Domain (Optional)

If you have a domain like `oneworldclassroom.de`:

1. In your repo, create a file named `CNAME` with your domain:
   ```
   oneworldclassroom.de
   ```
2. Go to your domain registrar (e.g. IONOS, Strato, Namecheap)
3. Add a CNAME DNS record:
   - Name: `www`
   - Value: `YOUR_USERNAME.github.io`
4. In GitHub → Settings → Pages → Custom domain, enter your domain
5. Check **Enforce HTTPS**

---

## Updating Your Site

Whenever you make changes to any file:

```bash
git add .
git commit -m "Update: describe what you changed"
git push
```

GitHub Actions will automatically re-deploy your site within 1–2 minutes.

---

## How Platform ↔ Admin Are Connected

The `js/owc-data.js` file acts as a shared database using browser localStorage:

| What happens on Platform | What shows in Admin |
|--------------------------|---------------------|
| Student clicks "Confirm Booking" | New booking appears in Admin → Bookings |
| Student fills in name/email | New student appears in Admin → Students |
| Payment recorded | Appears in Admin → Payments |

> Note: localStorage is **per-browser**. For a real multi-user database, consider upgrading to Supabase (free tier) — contact your developer.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Admin page shows login but won't accept password | Default is `owcadmin2025` — case sensitive |
| Site not updating after push | Check Actions tab for errors; wait 2 mins |
| 404 on admin page | Make sure `admin/index.html` exists in repo |
| `.github` folder not visible in file upload | Enable "Show hidden files" or use Git CLI |

---

## Support

Built for **One World Classroom** — Cottbus, Germany.
Platform connects German university students with PhD-level tutors from South Asia.
