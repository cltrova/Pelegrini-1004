param(
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.-]*$')]
    [string]$Servidor = 'caspper-vps'
)

$ErrorActionPreference = 'Stop'
$chaveProtegida = Read-Host 'Chave da OpenAI para o Pelegrini' -AsSecureString
$credencial = [pscredential]::new('openai', $chaveProtegida)
$chave = $credencial.GetNetworkCredential().Password

try {
    if ($chave -notmatch '^\S+$') {
        throw 'Cole somente a chave da OpenAI, sem espaços ou quebras de linha.'
    }

    $instalador = @'
set -eu
umask 077
diretorio=/etc/pelegrini/ia
arquivo="$diretorio/openai.env"

mkdir -p "$diretorio"
if test -e "$arquivo"; then
    echo 'O arquivo da chave já existe. Use a manutenção do servidor para trocar a credencial.' >&2
    exit 1
fi

IFS= read -r registro
registro=$(printf '%s' "$registro" | tr -d '\r')
case "$registro" in
    OPENAI_API_KEY=?*) ;;
    *) echo 'Chave ausente.' >&2; exit 1 ;;
esac

temporario=$(mktemp "$diretorio/.openai-XXXXXX")
trap 'rm -f -- "$temporario"' EXIT
printf '%s\n' "$registro" > "$temporario"
ln -- "$temporario" "$arquivo"
echo 'Chave cadastrada na VPS do Pelegrini.'
'@

    $instalador = $instalador.Replace("`r`n", "`n")
    "OPENAI_API_KEY=$chave" | ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 $Servidor $instalador
    if ($LASTEXITCODE -ne 0) {
        throw 'Não foi possível concluir o cadastro no servidor.'
    }
} finally {
    $chave = $null
    $credencial = $null
    $chaveProtegida.Dispose()
}
