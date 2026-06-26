<#
.SYNOPSIS
  Register the flake-triage skill as a daily Windows Task Scheduler job.

.DESCRIPTION
  Local leg of the scheduling pair (see .github/workflows/flake-triage.yml for the
  cloud leg). IMPORTANT: this local scheduler only turns while this machine stays
  on and logged in. It is not a substitute for the GitHub Actions cron — it's a
  convenience for running triage manually-on-a-timer during the day. The cloud
  cron is what keeps the loop running overnight or when the machine is off.

.PARAMETER Time
  Daily run time, 24h HH:mm format. Defaults to 06:00 to match the cloud cron.

.PARAMETER TaskName
  Scheduled task name. Defaults to 'FlakeTriageLoop'.

.EXAMPLE
  ./scripts/register-task.ps1
  Registers the task at 06:00 daily.

.EXAMPLE
  ./scripts/register-task.ps1 -Time 22:30
#>
param(
  [string]$Time = '06:00',
  [string]$TaskName = 'FlakeTriageLoop'
)

$ErrorActionPreference = 'Stop'

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
  throw "Not inside a git repository. Run this from within flaky-test-loop."
}

$claudeExe = (Get-Command claude -ErrorAction SilentlyContinue).Source
if (-not $claudeExe) {
  Write-Warning "Could not find 'claude' on PATH. The task will be registered but will fail to run until Claude Code is installed and on PATH."
  $claudeExe = 'claude'
}

$prompt = 'Run the flake-triage skill (.claude/skills/flake-triage/SKILL.md). For each kept flake, hand off to flake-fixer then have flake-reviewer adversarially verify before proposing a merge. Follow the Stop rules exactly.'

$action = New-ScheduledTaskAction `
  -Execute $claudeExe `
  -Argument "--print `"$prompt`"" `
  -WorkingDirectory $repoRoot

$trigger = New-ScheduledTaskTrigger -Daily -At $Time

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Daily flake-triage loop run. Local-only: only turns while this machine is on. See .github/workflows/flake-triage.yml for the cloud leg that runs regardless." `
  -Force

Write-Host "Registered scheduled task '$TaskName' to run daily at $Time."
Write-Host "Reminder: this only fires while the machine is on and logged in. Use the GitHub Actions workflow for overnight/always-on coverage."
