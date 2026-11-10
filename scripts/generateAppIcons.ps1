$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$brands = @(
  @{ Key='pelegrini'; Name='Grupo Pelegrini'; ShortName='Pelegrini'; Source='public/brand/home/grupo-pelegrini.png'; Background='#ffffff'; Scale=0.94; MaskScale=0.68 },
  @{ Key='transmissao'; Name='Casa da Transmissão'; ShortName='Transmissão'; Source='public/brand/casa-transmissao.png'; Background=$null; Scale=1.0; MaskScale=1.0 },
  @{ Key='chevrolet'; Name='Casa do Chevrolet'; ShortName='Chevrolet'; Source='public/brand/casa-chevrolet.png'; Background='#ffffff'; Scale=0.94; MaskScale=0.72 }
)
foreach ($brand in $brands) {
  $sourcePath = Join-Path $projectRoot $brand.Source
  $original = [System.Drawing.Bitmap]::new($sourcePath)
  $destination = Join-Path $projectRoot ('public/pwa/' + $brand.Key)
  [System.IO.Directory]::CreateDirectory($destination) | Out-Null
  try {
    $background = if ($brand.Background) { [System.Drawing.ColorTranslator]::FromHtml($brand.Background) } else { $original.GetPixel(0,0) }
    $outputs = @(
      @{ Size=180; File='apple-touch-icon.png'; Scale=$brand.Scale },
      @{ Size=192; File='icon-192.png'; Scale=$brand.Scale },
      @{ Size=512; File='icon-512.png'; Scale=$brand.Scale },
      @{ Size=512; File='icon-maskable-512.png'; Scale=$brand.MaskScale }
    )
    foreach ($output in $outputs) {
      $size = $output.Size
      $bitmap = [System.Drawing.Bitmap]::new($size,$size,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear($background)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $ratio = ($size * $output.Scale) / [Math]::Max($original.Width,$original.Height)
        $width = [int][Math]::Round($original.Width * $ratio)
        $height = [int][Math]::Round($original.Height * $ratio)
        $rectangle = [System.Drawing.Rectangle]::new([int](($size-$width)/2),[int](($size-$height)/2),$width,$height)
        $graphics.DrawImage($original,$rectangle)
        $bitmap.Save((Join-Path $destination $output.File),[System.Drawing.Imaging.ImageFormat]::Png)
      } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
    $manifest = [ordered]@{
      id=('/app/' + $brand.Key); name=$brand.Name; short_name=$brand.ShortName;
      description=('Sistema de gestão - ' + $brand.Name); lang='pt-BR'; start_url='/'; scope='/';
      display='standalone'; background_color='#080f1f'; theme_color='#073f73';
      icons=@(
        @{ src=('/pwa/'+$brand.Key+'/icon-192.png'); sizes='192x192'; type='image/png'; purpose='any' },
        @{ src=('/pwa/'+$brand.Key+'/icon-512.png'); sizes='512x512'; type='image/png'; purpose='any' },
        @{ src=('/pwa/'+$brand.Key+'/icon-maskable-512.png'); sizes='512x512'; type='image/png'; purpose='maskable' }
      )
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
    Write-Output ('Ícones gerados: '+$brand.Name)
  } finally { $original.Dispose() }
}
