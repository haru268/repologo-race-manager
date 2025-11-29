# Git Error Solutions

## Common Errors and Solutions

### Error 1: SSH Authentication Error
If you're using `git@github.com`, you need to set up SSH keys.

**Solution: Use HTTPS**

```bash
# Remove existing remote
git remote remove origin

# Add remote with HTTPS
git remote add origin https://github.com/haru268/-.git

# Push (authentication will be required)
git push -u origin main
```

### Error 2: Authentication Error (when using HTTPS)

**Solution 1: Use Personal Access Token**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token"
3. Select required permissions (repo)
4. Copy the token
5. Use the token instead of password when pushing

**Solution 2: Use GitHub CLI**
```bash
# Install GitHub CLI
# https://cli.github.com/

# Login
gh auth login

# Then push as usual
git push -u origin main
```

### Error 3: Remote Already Exists
```bash
# Check remotes
git remote -v

# Remove existing remote
git remote remove origin

# Add new remote
git remote add origin https://github.com/haru268/-.git
```

## Complete Setup Steps (Using HTTPS)

```bash
# 1. Initialize repository (if not already done)
git init

# 2. Add all files
git add .

# 3. Commit
git commit -m "Initial commit"

# 4. Rename branch to main
git branch -M main

# 5. Add remote (remove first if it exists)
git remote remove origin  # if it exists
git remote add origin https://github.com/haru268/-.git

# 6. Push
git push -u origin main
```
