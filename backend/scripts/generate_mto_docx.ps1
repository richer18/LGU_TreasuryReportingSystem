param(
    [Parameter(Mandatory = $true)][string]$TemplatePath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string]$ValuesPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function ConvertTo-TextValue([object]$Value) {
    if ($null -eq $Value) { return '' }
    return [string]$Value
}

function Set-WordTextSpacePreserve([System.Xml.XmlElement]$Node) {
    $text = [string]$Node.InnerText
    if ($text.Length -gt 0 -and ($text.StartsWith(' ') -or $text.EndsWith(' ') -or $text -match ' {2,}')) {
        $Node.SetAttribute('xml:space', 'preserve')
    }
}

function Preserve-WordTextSpaces([xml]$Document) {
    foreach ($node in @($Document.SelectNodes("//*[local-name()='t']"))) {
        [void](Set-WordTextSpacePreserve $node)
    }
}

function Get-TextMap([xml]$Document) {
    $nodes = @($Document.SelectNodes("//*[local-name()='t']"))
    $position = 0
    $infos = New-Object System.Collections.Generic.List[object]
    $builder = New-Object System.Text.StringBuilder

    foreach ($node in $nodes) {
        $text = [string]$node.InnerText
        [void]$builder.Append($text)
        $infos.Add([pscustomobject]@{
            Node = $node
            Text = $text
            Start = $position
            End = $position + $text.Length
        })
        $position += $text.Length
    }

    return [pscustomobject]@{
        Text = $builder.ToString()
        Infos = $infos
    }
}

function Get-OverlapLength([int]$AStart, [int]$AEnd, [int]$BStart, [int]$BEnd) {
    $start = [Math]::Max($AStart, $BStart)
    $end = [Math]::Min($AEnd, $BEnd)
    if ($end -le $start) { return 0 }
    return $end - $start
}

function Replace-MacroPreservingRun([xml]$Document, [string]$Key, [string]$Value) {
    $macro = '$' + '{' + $Key + '}'
    $changed = $false

    while ($true) {
        $map = Get-TextMap $Document
        $text = $map.Text
        $index = $text.IndexOf($macro, [System.StringComparison]::Ordinal)
        if ($index -lt 0) { break }

        $matchStart = $index
        $matchEnd = $index + $macro.Length
        $nameStart = $matchStart + 2
        $nameEnd = $matchEnd - 1

        $overlaps = @($map.Infos | Where-Object { $_.End -gt $matchStart -and $_.Start -lt $matchEnd })
        if ($overlaps.Count -eq 0) { break }

        $chosen = $overlaps[0]
        $chosenScore = -1
        foreach ($info in $overlaps) {
            $score = Get-OverlapLength $info.Start $info.End $nameStart $nameEnd
            if ($score -gt $chosenScore) {
                $chosen = $info
                $chosenScore = $score
            }
        }

        foreach ($info in $overlaps) {
            $nodeText = [string]$info.Node.InnerText
            $newText = ''

            if ($info.Start -lt $matchStart -and $info.End -gt $matchStart) {
                $newText += $nodeText.Substring(0, $matchStart - $info.Start)
            }

            if ([object]::ReferenceEquals($info.Node, $chosen.Node)) {
                $newText += $Value
            }

            if ($info.Start -lt $matchEnd -and $info.End -gt $matchEnd) {
                $newText += $nodeText.Substring($matchEnd - $info.Start)
            }

            $info.Node.InnerText = $newText
            Set-WordTextSpacePreserve $info.Node
        }

        $changed = $true
    }

    return $changed
}

function Replace-ValuesInXml([string]$Xml, [object]$Values) {
    $document = New-Object System.Xml.XmlDocument
    $document.PreserveWhitespace = $true
    $document.LoadXml($Xml)

    foreach ($property in $Values.PSObject.Properties) {
        [void](Replace-MacroPreservingRun $document $property.Name (ConvertTo-TextValue $property.Value))
    }

    [void](Preserve-WordTextSpaces $document)

    $outerXml = $document.OuterXml
    $outerXml = [regex]::Replace($outerXml, '\s+[A-Za-z_][A-Za-z0-9_\-\.]*:space="preserve"\s+xmlns:[A-Za-z_][A-Za-z0-9_\-\.]*="http://www\.w3\.org/XML/1998/namespace"', ' xml:space="preserve"')
    $outerXml = [regex]::Replace($outerXml, '\s+xmlns:[A-Za-z_][A-Za-z0-9_\-\.]*="http://www\.w3\.org/XML/1998/namespace"\s+[A-Za-z_][A-Za-z0-9_\-\.]*:space="preserve"', ' xml:space="preserve"')

    return $outerXml
}

$values = Get-Content -LiteralPath $ValuesPath -Raw | ConvertFrom-Json
$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Copy-Item -LiteralPath $TemplatePath -Destination $OutputPath -Force
$archive = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Update)

try {
    $updates = @()

    foreach ($entry in @($archive.Entries)) {
        if (-not ($entry.FullName.StartsWith('word/') -and $entry.FullName.EndsWith('.xml'))) {
            continue
        }

        $stream = $entry.Open()
        try {
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $xml = $reader.ReadToEnd()
        } finally {
            $stream.Dispose()
        }

        if ($xml.Contains('$' + '{')) {
            $xml = Replace-ValuesInXml $xml $values
        }

        $updates += [pscustomobject]@{ Name = $entry.FullName; Xml = $xml }
    }

    foreach ($update in $updates) {
        $existing = $archive.GetEntry($update.Name)
        if ($null -ne $existing) { $existing.Delete() }

        $newEntry = $archive.CreateEntry($update.Name)
        $stream = $newEntry.Open()
        try {
            $writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
            $writer.Write($update.Xml)
            $writer.Flush()
        } finally {
            $stream.Dispose()
        }
    }
} finally {
    $archive.Dispose()
}
