# GitHub Repository Setup Instructions

## Option 1: Create via GitHub Web Interface (Recommended)

1. Go to: https://github.com/new

2. Fill in the form:
   - **Repository name:** `vidvur-mpv-poc`
   - **Description:** `Proof of concept testing mpv's codec support and frame-accurate playback for VidVuR integration`
   - **Visibility:** Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)

3. Click "Create repository"

4. Run these commands in your terminal:
   ```bash
   cd /Users/2018macbook/vidvur-mpv-poc
   git remote add origin https://github.com/YOUR_USERNAME/vidvur-mpv-poc.git
   git branch -M main
   git push -u origin main
   ```

## Option 2: Using GitHub CLI (if installed later)

```bash
cd /Users/2018macbook/vidvur-mpv-poc
gh repo create vidvur-mpv-poc \
  --public \
  --source=. \
  --description="Proof of concept testing mpv's codec support and frame-accurate playback for VidVuR integration" \
  --push
```

## Verify

After pushing, visit: https://github.com/YOUR_USERNAME/vidvur-mpv-poc
