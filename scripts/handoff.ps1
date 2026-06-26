<#
.SYNOPSIS
  Create or tear down a per-flake git worktree for the flake-triage loop.

.DESCRIPTION
  Each flaky test gets its own worktree on branch flake/<slug>, so the generator
  agent can work on multiple flakes in parallel without one fix attempt clobbering
  another's working tree. Worktrees live under ../flaky-test-loop-worktrees/<slug>
  (a sibling directory, not nested inside the main repo).

.PARAMETER Action
  'create' or 'remove'.

.PARAMETER Slug
  Short kebab-case id for the flake, e.g. 'race-worker-timer'. Used for both the
  branch name (flake/<slug>) and the worktree directory name.

.EXAMPLE
  ./scripts/handoff.ps1 -Action create -Slug race-worker-timer

.EXAMPLE
  ./scripts/handoff.ps1 -Action remove -Slug race-worker-timer
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('create', 'remove')]
  [string]$Action,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9]+(-[a-z0-9]+)*$')]
  [string]$Slug
)

$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
  throw "Not inside a git repository. Run this from within flaky-test-loop."
}

$branch = "flake/$Slug"
$worktreeRoot = Join-Path (Split-Path $repoRoot -Parent) 'flaky-test-loop-worktrees'
$worktreePath = Join-Path $worktreeRoot $Slug

if ($Action -eq 'create') {
  if (Test-Path $worktreePath) {
    Write-Host "Worktree already exists: $worktreePath"
    exit 0
  }
  New-Item -ItemType Directory -Force -Path $worktreeRoot | Out-Null

  $branchExists = git -C $repoRoot branch --list $branch
  if ($branchExists) {
    Write-Host "Branch $branch already exists, attaching worktree to it."
    git -C $repoRoot worktree add $worktreePath $branch
  } else {
    git -C $repoRoot worktree add -b $branch $worktreePath
  }

  Write-Host "Worktree ready: $worktreePath (branch $branch)"
  Write-Host "cd `"$worktreePath`" && npm install"
}
elseif ($Action -eq 'remove') {
  if (-not (Test-Path $worktreePath)) {
    Write-Host "No worktree at $worktreePath (already removed?)"
  } else {
    git -C $repoRoot worktree remove $worktreePath --force
    Write-Host "Removed worktree: $worktreePath"
  }

  $branchExists = git -C $repoRoot branch --list $branch
  if ($branchExists) {
    Write-Host "Branch $branch still exists. Delete it manually once its PR is merged or abandoned:"
    Write-Host "  git branch -D $branch"
  }
}
