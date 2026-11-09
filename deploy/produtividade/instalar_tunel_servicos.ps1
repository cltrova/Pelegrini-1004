$ErrorActionPreference = 'Stop'
$base = 'C:\ApiSql\Produtividade_TLS'
$ponte = '\\tsclient\_home_rafa_Compartilhado-Pelegrini'
$nssm = 'C:\ApiSql\nssm.exe'
$python = 'C:\Program Files\Python313\python.exe'
if (!(Test-Path $python)) { throw 'Python 3.13 nao encontrado no caminho esperado.' }
foreach ($nome in @('PelegriniProdutividadeTLS','PelegriniProdutividadeTunel')) {
    if (Get-Service $nome -ErrorAction SilentlyContinue) { throw "Servico ja existe: $nome. Pare aqui." }
}
foreach ($arquivo in @('servidor.crt','servidor.key','tunel_rsa')) {
    if (!(Test-Path "$base\$arquivo")) { throw "Arquivo ausente: $arquivo" }
}
if ((Invoke-RestMethod 'http://127.0.0.1:5000/operacional/produtividade/versao' -TimeoutSec 30).release -ne 'pelegrini-produtividade-chevrolet-20261109-r13') { throw 'R13 oficial nao esta ativa.' }
Copy-Item "$ponte\produtividade_tls_servico.py" "$base\produtividade_tls_servico.py" -Force
Copy-Item "$ponte\produtividade_tunel_teste.py" "$base\produtividade_tunel_servico.py" -Force
foreach ($arquivo in @('servidor.key','tunel_rsa')) {
    & icacls.exe "$base\$arquivo" /inheritance:r /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Falha ao proteger a chave: $arquivo" }
}
function Nssm {
    & $nssm @args
    if ($LASTEXITCODE -ne 0) { throw "NSSM falhou: $($args -join ' ')" }
}
Nssm @('install','PelegriniProdutividadeTLS',$python,"$base\produtividade_tls_servico.py")
Nssm @('set','PelegriniProdutividadeTLS','AppDirectory',$base)
Nssm @('set','PelegriniProdutividadeTLS','AppEnvironmentExtra','PRODUTIVIDADE_PORTA_LOCAL=5000')
Nssm @('set','PelegriniProdutividadeTLS','Start','SERVICE_AUTO_START')
Nssm @('install','PelegriniProdutividadeTunel',$python,"$base\produtividade_tunel_servico.py")
Nssm @('set','PelegriniProdutividadeTunel','AppDirectory',$base)
Nssm @('set','PelegriniProdutividadeTunel','Start','SERVICE_AUTO_START')
$testes = Get-WmiObject Win32_Process | Where-Object {
    $_.Name -ieq 'python.exe' -and $_.CommandLine -and
    ($_.CommandLine -match 'produtividade_tls_teste\.py' -or $_.CommandLine -match 'produtividade_tunel_teste\.py')
}
foreach ($processo in $testes) { Stop-Process -Id $processo.ProcessId -ErrorAction Stop }
Start-Service PelegriniProdutividadeTLS -ErrorAction Stop
(Get-Service PelegriniProdutividadeTLS).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
Start-Service PelegriniProdutividadeTunel -ErrorAction Stop
(Get-Service PelegriniProdutividadeTunel).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
Get-Service ApiSqlServer,PelegriniProdutividadeTLS,PelegriniProdutividadeTunel | Select-Object Name,Status | Format-Table -AutoSize
'SERVICOS DE PRODUTIVIDADE INICIADOS'
