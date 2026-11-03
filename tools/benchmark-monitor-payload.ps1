$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$durationSeconds = __DURATION_SECONDS__
$startedUtc = [DateTime]::UtcNow

function Convert-IntegerOrNull($value) {
    if ($null -eq $value) { return $null }
    return [long]$value
}

for ($sampleIndex = 0; $sampleIndex -lt $durationSeconds; $sampleIndex++) {
    $errors = New-Object 'System.Collections.Generic.List[string]'
    $memory = @{ availableMiB = $null; committedBytes = $null; commitLimitBytes = $null }
    $gpu = @{ usedMiB = $null; freeMiB = $null; totalMiB = $null; utilizationPct = $null }
    $server = $null

    try {
        $memoryRecord = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory
        if ($null -eq $memoryRecord) { throw 'missing memory counter' }
        $memory.availableMiB = Convert-IntegerOrNull $memoryRecord.AvailableMBytes
        $memory.committedBytes = Convert-IntegerOrNull $memoryRecord.CommittedBytes
        $memory.commitLimitBytes = Convert-IntegerOrNull $memoryRecord.CommitLimit
    }
    catch {
        [void]$errors.Add('memory_query_failed')
    }

    try {
        $gpuLines = @(& nvidia-smi --query-gpu=memory.used,memory.free,memory.total,utilization.gpu --format=csv,noheader,nounits 2>$null)
        if ($LASTEXITCODE -ne 0 -or $gpuLines.Count -ne 1) {
            if ($gpuLines.Count -gt 1) { [void]$errors.Add('gpu_ambiguous') }
            else { [void]$errors.Add('gpu_query_failed') }
        }
        else {
            $values = @($gpuLines[0] -split ',')
            if ($values.Count -ne 4) { throw 'invalid GPU record' }
            $culture = [System.Globalization.CultureInfo]::InvariantCulture
            $gpu.usedMiB = [double]::Parse($values[0].Trim(), $culture)
            $gpu.freeMiB = [double]::Parse($values[1].Trim(), $culture)
            $gpu.totalMiB = [double]::Parse($values[2].Trim(), $culture)
            $gpu.utilizationPct = [double]::Parse($values[3].Trim(), $culture)
        }
    }
    catch {
        $gpu.usedMiB = $null
        $gpu.freeMiB = $null
        $gpu.totalMiB = $null
        $gpu.utilizationPct = $null
        if (-not $errors.Contains('gpu_query_failed')) { [void]$errors.Add('gpu_query_failed') }
    }

    try {
        $processes = @(Get-CimInstance -ClassName Win32_Process -Filter "Name='llama-server.exe'")
        if ($processes.Count -eq 0) {
            [void]$errors.Add('server_absent')
        }
        elseif ($processes.Count -gt 1) {
            [void]$errors.Add('server_ambiguous')
        }
        else {
            $pidValue = [int]$processes[0].ProcessId
            $perfRecords = @(Get-CimInstance -ClassName Win32_PerfFormattedData_PerfProc_Process | Where-Object { [int]$_.IDProcess -eq $pidValue })
            if ($perfRecords.Count -ne 1) {
                [void]$errors.Add('server_process_metrics_missing')
            }
            else {
                $server = @{
                    pid = $pidValue
                    workingSetBytes = Convert-IntegerOrNull $perfRecords[0].WorkingSet
                    privateWorkingSetBytes = Convert-IntegerOrNull $perfRecords[0].WorkingSetPrivate
                    privateBytes = Convert-IntegerOrNull $perfRecords[0].PrivateBytes
                }
            }
        }
    }
    catch {
        $server = $null
        [void]$errors.Add('server_query_failed')
    }

    $record = @{
        version = 1
        timestampUtc = [DateTime]::UtcNow.ToString('o', [System.Globalization.CultureInfo]::InvariantCulture)
        memory = $memory
        gpu = $gpu
        server = $server
        errors = @($errors.ToArray())
    }
    [Console]::Out.WriteLine(($record | ConvertTo-Json -Compress -Depth 4))

    $nextSampleUtc = $startedUtc.AddSeconds($sampleIndex + 1)
    $sleepMilliseconds = [int][Math]::Max(0, ($nextSampleUtc - [DateTime]::UtcNow).TotalMilliseconds)
    if ($sleepMilliseconds -gt 0 -and $sampleIndex -lt ($durationSeconds - 1)) {
        Start-Sleep -Milliseconds $sleepMilliseconds
    }
}
