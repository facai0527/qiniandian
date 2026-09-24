$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = Join-Path $root 'qiniandian-github-upload.zip'
if (Test-Path -LiteralPath $output) { throw 'Upload archive already exists. Rename it before making a new one.' }
$files = @()
foreach ($folder in @('src', 'public', 'scripts', '.github')) {
  $files += Get-ChildItem -LiteralPath (Join-Path $root $folder) -Recurse -File -Force
}
foreach ($name in @('package.json', 'package-lock.json', 'vite.config.js', 'index.html', 'history.html', '.gitignore', 'README.md', 'SCROLL-PREVIEW.md', 'COLOR-DIRECTION.md', 'RENDERING-NOTES.md')) {
  $files += Get-Item -LiteralPath (Join-Path $root $name) -Force
}
$archive = [IO.Compression.ZipFile]::Open($output, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files) {
    if (-not $file.FullName.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) { throw 'File is outside the website directory.' }
    $entry = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
    if ($entry -match '(^|/)(node_modules|dist|\.git|\.env)(/|$)' -or $file.Length -gt 25MB) { throw "Unexpected upload file: $entry" }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($output)
try {
  foreach ($required in @('.github/workflows/deploy.yml', 'package.json', 'public/models/qiniandian_archive_web_v02.glb', 'public/models/qiniandian_archive_lite_v02.glb', 'public/art/gilded-landscape-wide-loop-v1.mp4', 'public/art/gilded-landscape-mobile-loop-v1.mp4')) {
    if ($null -eq $check.GetEntry($required)) { throw "Missing ZIP entry: $required" }
  }
  [PSCustomObject]@{ Archive = $output; Files = $check.Entries.Count; Bytes = (Get-Item -LiteralPath $output).Length }
} finally { $check.Dispose() }
