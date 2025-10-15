Amazon Listing Image Generator (Figma Plugin)

Generate Amazon-ready listing images from a selected product image:
- Background removal via remove.bg
- Auto-compose white background main image (2000–2560 px)
- Export PNG/JPEG presets

Usage
1. In Figma, run the plugin.
2. Paste your remove.bg API key in the UI and Save.
3. Select a node (product image) on the canvas.
4. Choose size (e.g., 2000) and click "Generate Main Image".
5. Export PNG or JPG.

Notes
- API key is stored per-user using Figma clientStorage.
- Network access is restricted to https://api.remove.bg by the manifest.
- The first version targets the main image. Lifestyle/infographic templates can be added next.
