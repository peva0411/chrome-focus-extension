# Icon Conversion Note

The current icons are SVG files for development purposes. Chrome extensions officially support PNG icons.

## Converting SVG to PNG

You can convert these SVG files to PNG using:

1. **Online Tools:**
   - CloudConvert.com
   - SVG2PNG.com

2. **Command Line (if you have ImageMagick):**
   ```bash
   magick convert icon16.svg icon16.png
   magick convert icon32.svg icon32.png
   magick convert icon48.svg icon48.png
   magick convert icon128.svg icon128.png
   ```

3. **PowerShell Script:**
   Run `create-icons.ps1` (requires System.Drawing assembly)

4. **Design Tool:**
   - Open SVG in Inkscape, Figma, or Illustrator
   - Export as PNG at the specified sizes

After conversion, update the manifest.json to reference .png files instead of .svg files.

Note: SVG icons may work in Chrome, but PNG is the recommended format for maximum compatibility.
