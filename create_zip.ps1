Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$currentDir = Get-Location
$zipPath = Join-Path $currentDir "dist.zip"
$distDir = Join-Path $currentDir "dist"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $distDir -Recurse -File | ForEach-Object {
    $file = $_
    $relPath = $file.FullName.Substring($distDir.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relPath) | Out-Null
}

$zip.Dispose()

Write-Host "ZIP created successfully with UNIX slashes:"
[System.IO.Compression.ZipFile]::OpenRead($zipPath).Entries | Select-Object FullName, Length
