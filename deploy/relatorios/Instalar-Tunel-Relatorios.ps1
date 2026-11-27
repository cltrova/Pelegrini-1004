$ErrorActionPreference = 'Stop'
$destino = 'C:\ApiSql\RelatoriosVps'
$python = 'C:\Program Files\Python313\python.exe'
$nssm = 'C:\ApiSql\nssm.exe'
$servico = 'PelegriniRelatoriosTunel'
$script = Join-Path $destino 'Tunel-Relatorios.py'
$logs = Join-Path $destino 'logs'

if (-not (Test-Path -LiteralPath $python -PathType Leaf) -or -not (Test-Path -LiteralPath $nssm -PathType Leaf)) {
    throw 'Python ou NSSM do Windows nao localizado.'
}
$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identidade)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Abra o PowerShell como administrador.'
}

& $python -c 'import paramiko'
if ($LASTEXITCODE -ne 0) { throw 'A biblioteca de tunel do Windows nao esta disponivel.' }
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $conexao = $tcp.BeginConnect('192.168.141.102', 1433, $null, $null)
    if (-not $conexao.AsyncWaitHandle.WaitOne(5000)) { throw 'Windows nao alcanca o SQL Server na porta 1433.' }
    $tcp.EndConnect($conexao)
} finally { $tcp.Dispose() }

New-Item -Path $destino -ItemType Directory -Force | Out-Null
& icacls.exe $destino /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)(F)' '*S-1-5-32-544:(OI)(CI)(F)' '*S-1-5-19:(OI)(CI)(RX)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel proteger os arquivos de Relatorios.' }
New-Item -Path $logs -ItemType Directory -Force | Out-Null
& icacls.exe $logs /grant:r '*S-1-5-19:(OI)(CI)(M)' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel configurar a pasta de logs.' }

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Tunel-Relatorios.py') -Destination $script -Force
$publica = & $python $script --public-key
if ($LASTEXITCODE -ne 0 -or $publica -notmatch '^ssh-rsa [A-Za-z0-9+/]+={0,2}$') { throw 'Falha ao gerar a chave do tunel.' }
Set-Content -LiteralPath (Join-Path $PSScriptRoot 'relatorios-tunel.pub') -Value $publica -Encoding Ascii
'CHAVE PUBLICA DE RELATORIOS DISPONIVEL NA PONTE.'

function Nssm {
    & $nssm @args
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar o servico de tunel de Relatorios.' }
}

$anterior = Get-Service -Name $servico -ErrorAction SilentlyContinue
if ($anterior -and $anterior.Status -ne 'Stopped') { Stop-Service -Name $servico }
if ($anterior) {
    Nssm set $servico Application $python
    Nssm set $servico AppParameters "`"$script`""
} else { Nssm install $servico $python "`"$script`"" }
Nssm set $servico AppDirectory $destino
Nssm set $servico ObjectName 'NT AUTHORITY\LocalService'
Nssm set $servico Start SERVICE_AUTO_START
Nssm set $servico AppStdout (Join-Path $logs 'tunel.log')
Nssm set $servico AppRotateFiles 1
Nssm set $servico AppRotateOnline 1
Nssm set $servico AppRotateBytes 1048576
Start-Service -Name $servico
Get-Service -Name $servico | Format-Table Name, Status -AutoSize
