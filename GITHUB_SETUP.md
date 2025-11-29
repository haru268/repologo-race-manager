# GitHub Upload Instructions

## Method 1: Using Git Commands (Recommended)

### 1. Install Git
- Download and install Git for Windows from https://git-scm.com/download/win

### 2. Create GitHub Repository
1. Log in to https://github.com
2. Click the "+" icon in the top right → "New repository"
3. Enter repository name (e.g., `repo-race-manager`)
4. Click "Create repository"

### 3. Initialize Git Repository Locally
```bash
git init
git add .
git commit -m "Initial commit: REPO Team Survival Race Management System"
```

### 4. Connect to GitHub Repository
```bash
git remote add origin https://github.com/your-username/repository-name.git
git branch -M main
git push -u origin main
```

## Method 2: Using GitHub Desktop

1. Download and install GitHub Desktop from https://desktop.github.com/
2. Open GitHub Desktop and log in
3. Click "File" → "Add Local Repository" and select this folder
4. Click "Publish repository" to upload to GitHub

## Method 3: Upload via GitHub Web Interface

1. Log in to https://github.com
2. Create a new repository
3. Click "uploading an existing file"
4. Drag and drop files from this folder to upload
