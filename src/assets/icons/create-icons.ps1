Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 128)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    
    # Create gradient brush (purple/blue gradient)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($size, $size),
        [System.Drawing.Color]::FromArgb(102, 126, 234),
        [System.Drawing.Color]::FromArgb(118, 75, 162)
    )
    
    # Draw circle
    $g.FillEllipse($brush, 2, 2, $size - 4, $size - 4)
    
    # Save
    $bmp.Save("$PSScriptRoot\icon$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $g.Dispose()
    $bmp.Dispose()
    $brush.Dispose()
}

Write-Host "Icons created successfully!"
