# GitHub Updater Scripts

These batch files help update the `LGU_TreasuryReportingSystem` repository from Windows.

## Files

```text
github_menu.bat           Opens the menu
git_status.bat            Shows branch, status, remote, and latest commit
update_github.bat         Commits local changes and pushes to GitHub main
update_local_machine.bat  Pulls/rebases latest GitHub main into this machine
```

## Safety Rules

```text
The scripts use GIT_OPTIONAL_LOCKS=0 to reduce OneDrive .git/index.lock problems.
Push and pull scripts require the current branch to be main.
Pull is blocked when local changes exist.
Push fetches GitHub first and blocks if GitHub has changes missing locally.
```

## Recommended Workflow

```text
1. Run github_menu.bat
2. Choose 1 to check status
3. Choose 3 to update local machine from GitHub if needed
4. Choose 2 to commit and push local changes to GitHub
```

If `.git/index.lock` appears, close GitHub Desktop, VS Code Git operations, and other Git terminals. Delete the lock file only when no Git process is running.
