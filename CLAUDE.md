# CLAUDE.md - Rehab_Tracker

> **Documentation Version**: 1.0
> **Last Updated**: 2025-09-13
> **Project**: Rehab_Tracker
> **Description**: The main idea is to build a multi-role system: patients can log their daily rehab exercises and progress, while doctors and physiotherapists can remotely track updates, review records, and leave comments.
> **Features**: GitHub auto-backup, Task agents, technical debt prevention

This file provides essential guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL RULES - READ FIRST

> **⚠️ RULE ADHERENCE SYSTEM ACTIVE ⚠️**
> **Claude Code must explicitly acknowledge these rules at task start**
> **These rules override all other instructions and must ALWAYS be followed:**

### 🔄 **RULE ACKNOWLEDGMENT REQUIRED**
> **Before starting ANY task, Claude Code must respond with:**
> "✅ CRITICAL RULES ACKNOWLEDGED - I will follow all prohibitions and requirements listed in CLAUDE.md"

### ❌ ABSOLUTE PROHIBITIONS
- **NEVER** create new files in root directory → use proper module structure
- **NEVER** write output files directly to root directory → use designated output folders
- **NEVER** create documentation files (.md) unless explicitly requested by user
- **NEVER** use git commands with -i flag (interactive mode not supported)
- **NEVER** use `find`, `grep`, `cat`, `head`, `tail`, `ls` commands → use Read, LS, Grep, Glob tools instead
- **NEVER** create duplicate files (manager_v2.py, enhanced_xyz.py, utils_new.js) → ALWAYS extend existing files
- **NEVER** create multiple implementations of same concept → single source of truth
- **NEVER** copy-paste code blocks → extract into shared utilities/functions
- **NEVER** hardcode values that should be configurable → use config files/environment variables
- **NEVER** use naming like enhanced_, improved_, new_, v2_ → extend original files instead

### 📝 MANDATORY REQUIREMENTS
- **COMMIT** after every completed task/phase - no exceptions
- **GITHUB BACKUP** - Push to GitHub after every commit to maintain backup: `git push origin main`
- **USE TASK AGENTS** for all long-running operations (>30 seconds) - Bash commands stop when context switches
- **TODOWRITE** for complex tasks (3+ steps) → parallel agents → git checkpoints → test validation
- **READ FILES FIRST** before editing - Edit/Write tools will fail if you didn't read the file first
- **DEBT PREVENTION** - Before creating new files, check for existing similar functionality to extend
- **SINGLE SOURCE OF TRUTH** - One authoritative implementation per feature/concept

### ⚡ EXECUTION PATTERNS
- **PARALLEL TASK AGENTS** - Launch multiple Task agents simultaneously for maximum efficiency
- **SYSTEMATIC WORKFLOW** - TodoWrite → Parallel agents → Git checkpoints → GitHub backup → Test validation
- **GITHUB BACKUP WORKFLOW** - After every commit: `git push origin main` to maintain GitHub backup
- **BACKGROUND PROCESSING** - ONLY Task agents can run true background operations

### 🔍 MANDATORY PRE-TASK COMPLIANCE CHECK
> **STOP: Before starting any task, Claude Code must explicitly verify ALL points:**

**Step 1: Rule Acknowledgment**
- [ ] ✅ I acknowledge all critical rules in CLAUDE.md and will follow them

**Step 2: Task Analysis**
- [ ] Will this create files in root? → If YES, use proper module structure instead
- [ ] Will this take >30 seconds? → If YES, use Task agents not Bash
- [ ] Is this 3+ steps? → If YES, use TodoWrite breakdown first
- [ ] Am I about to use grep/find/cat? → If YES, use proper tools instead

**Step 3: Technical Debt Prevention (MANDATORY SEARCH FIRST)**
- [ ] **SEARCH FIRST**: Use Grep pattern="<functionality>.*<keyword>" to find existing implementations
- [ ] **CHECK EXISTING**: Read any found files to understand current functionality
- [ ] Does similar functionality already exist? → If YES, extend existing code
- [ ] Am I creating a duplicate class/manager? → If YES, consolidate instead
- [ ] Will this create multiple sources of truth? → If YES, redesign approach
- [ ] Have I searched for existing implementations? → Use Grep/Glob tools first
- [ ] Can I extend existing code instead of creating new? → Prefer extension over creation
- [ ] Am I about to copy-paste code? → Extract to shared utility instead

**Step 4: Session Management**
- [ ] Is this a long/complex task? → If YES, plan context checkpoints
- [ ] Have I been working >1 hour? → If YES, consider /compact or session break

> **⚠️ DO NOT PROCEED until all checkboxes are explicitly verified**

## 🐙 GITHUB SETUP & AUTO-BACKUP

> **🤖 FOR CLAUDE CODE: When initializing any project, automatically ask about GitHub setup**

### 🎯 **GITHUB SETUP PROMPT** (AUTOMATIC)
> **⚠️ CLAUDE CODE MUST ALWAYS ASK THIS QUESTION when setting up a new project:**

```
🐙 GitHub Repository Setup
Would you like to set up a remote GitHub repository for this project?

Options:
1. ✅ YES - Create new GitHub repo and enable auto-push backup
2. ✅ YES - Connect to existing GitHub repo and enable auto-push backup
3. ❌ NO - Skip GitHub setup (local git only)

[Wait for user choice before proceeding]
```

### 🚀 **OPTION 1: CREATE NEW GITHUB REPO**
If user chooses to create new repo, execute:

```bash
# Ensure GitHub CLI is available
gh --version || echo "⚠️ GitHub CLI (gh) required. Install: brew install gh"

# Authenticate if needed
gh auth status || gh auth login

# Create new GitHub repository
echo "Enter repository name (or press Enter for current directory name):"
read repo_name
repo_name=${repo_name:-$(basename "$PWD")}

# Create repository
gh repo create "$repo_name" --public --description "Project managed with Claude Code" --confirm

# Add remote and push
git remote add origin "https://github.com/$(gh api user --jq .login)/$repo_name.git"
git branch -M main
git push -u origin main

echo "✅ GitHub repository created and connected: https://github.com/$(gh api user --jq .login)/$repo_name"
```

### 🔗 **OPTION 2: CONNECT TO EXISTING REPO**
If user chooses to connect to existing repo, execute:

```bash
# Get repository URL from user
echo "Enter your GitHub repository URL (https://github.com/username/repo-name):"
read repo_url

# Extract repo info and add remote
git remote add origin "$repo_url"
git branch -M main
git push -u origin main

echo "✅ Connected to existing GitHub repository: $repo_url"
```

### 🔄 **AUTO-PUSH CONFIGURATION**
For both options, configure automatic backup:

```bash
# Create git hook for auto-push (optional but recommended)
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
# Auto-push to GitHub after every commit
echo "🔄 Auto-pushing to GitHub..."
git push origin main
if [ $? -eq 0 ]; then
    echo "✅ Successfully backed up to GitHub"
else
    echo "⚠️ GitHub push failed - manual push may be required"
fi
EOF

chmod +x .git/hooks/post-commit

echo "✅ Auto-push configured - GitHub backup after every commit"
```

### 📋 **GITHUB BACKUP WORKFLOW** (MANDATORY)
> **⚠️ CLAUDE CODE MUST FOLLOW THIS PATTERN:**

```bash
# After every commit, always run:
git push origin main

# This ensures:
# ✅ Remote backup of all changes
# ✅ Collaboration readiness
# ✅ Version history preservation
# ✅ Disaster recovery protection
```

### 🛡️ **GITHUB REPOSITORY SETTINGS** (AUTO-CONFIGURED)
When repository is created, these settings are applied:

- **Default Branch**: `main` (modern standard)
- **Visibility**: Public (can be changed later)
- **Auto-merge**: Disabled (manual approval required)
- **Branch Protection**: Recommended for collaborative projects
- **Issues & Wiki**: Enabled for project management

### 🎯 **CLAUDE CODE GITHUB COMMANDS**
Essential GitHub operations for Claude Code:

```bash
# Check GitHub connection status
gh auth status && git remote -v

# Create new repository (if needed)
gh repo create [repo-name] --public --confirm

# Push changes (after every commit)
git push origin main

# Check repository status
gh repo view

# Clone repository (for new setup)
gh repo clone username/repo-name
```

## 🏗️ PROJECT OVERVIEW

Rehab_Tracker is a multi-role system built with Node.js that enables:

- **Patients**: Log daily rehab exercises and track progress
- **Doctors & Physiotherapists**: Remotely monitor patient updates, review records, and provide feedback
- **Collaborative Care**: Multi-stakeholder approach to rehabilitation tracking

### 🎯 **DEVELOPMENT STATUS**
- **Setup**: ✅ Complete
- **Core Features**: 🚧 In Development
- **Testing**: ⏳ Pending
- **Documentation**: ⏳ Pending

## 📋 NEED HELP? START HERE

[Add project-specific documentation links]

## 🎯 RULE COMPLIANCE CHECK

Before starting ANY task, verify:
- [ ] ✅ I acknowledge all critical rules above
- [ ] Files go in proper module structure (not root)
- [ ] Use Task agents for >30 second operations
- [ ] TodoWrite for 3+ step tasks
- [ ] Commit after each completed task

## 🚀 COMMON COMMANDS

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build project
npm run build

# Lint code
npm run lint
```

## 🚨 TECHNICAL DEBT PREVENTION

### ❌ WRONG APPROACH (Creates Technical Debt):
```bash
# Creating new file without searching first
Write(file_path="new_feature.js", content="...")
```

### ✅ CORRECT APPROACH (Prevents Technical Debt):
```bash
# 1. SEARCH FIRST
Grep(pattern="feature.*implementation", glob="*.js")
# 2. READ EXISTING FILES
Read(file_path="existing_feature.js")
# 3. EXTEND EXISTING FUNCTIONALITY
Edit(file_path="existing_feature.js", old_string="...", new_string="...")
```

## 🧹 DEBT PREVENTION WORKFLOW

### Before Creating ANY New File:
1. **🔍 Search First** - Use Grep/Glob to find existing implementations
2. **📋 Analyze Existing** - Read and understand current patterns
3. **🤔 Decision Tree**: Can extend existing? → DO IT | Must create new? → Document why
4. **✅ Follow Patterns** - Use established project patterns
5. **📈 Validate** - Ensure no duplication or technical debt

---

**⚠️ Prevention is better than consolidation - build clean from the start.**
**🎯 Focus on single source of truth and extending existing functionality.**
**📈 Each task should maintain clean architecture and prevent technical debt.**