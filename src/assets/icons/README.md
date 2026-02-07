# Icon Conversion Note

The current icons are SVG files for development purposes. Chrome extensions officially support PNG icons.

## Icon States

### Active State (`active/`)
- **Color**: Green (#4ade80) - matches the popup's active status dot
- **When**: Blocking is active and not paused
- Files: icon16.png, icon32.png, icon48.png, icon128.png

### Paused State (`paused/`)
- **Color**: Yellow/Amber (#fbbf24) - matches the popup's paused status dot
- **When**: Blocking is paused
- Files: icon16.png, icon32.png, icon48.png, icon128.png

### Current Status
**Placeholder icons** are currently in place (copies of the original icons). These need to be replaced with properly colored versions.

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
   - Change the icon color to green (#4ade80) or yellow (#fbbf24)
   - Export as PNG at the specified sizes to the appropriate directory

After conversion, the extension will automatically use the colored icons based on blocking state.

Note: SVG icons may work in Chrome, but PNG is the recommended format for maximum compatibility.
