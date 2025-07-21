#!/usr/bin/env python3
"""Switch to production mode by enabling production scripts and disabling dev scripts."""

import re

def switch_to_prod():
    with open('index.html', 'r') as f:
        content = f.read()
    
    # Switch color-modes script
    # Comment out development color-modes if it's active
    content = re.sub(
        r'^\s*<script src="/js/color-modes\.js"></script>',
        r'\t<!-- <script src="/js/color-modes.js"></script> -->',
        content,
        flags=re.MULTILINE
    )
    # Uncomment production color-modes if it's commented
    content = re.sub(
        r'^\s*<!-- <script src="/mesa-explorer/js/color-modes\.js"></script> -->',
        r'\t<script src="/mesa-explorer/js/color-modes.js"></script>',
        content,
        flags=re.MULTILINE
    )
    
    # Handle development scripts - comment them out if they're active
    # First, comment out individual active development scripts
    dev_scripts = [
        'file-manager.js', 'ui-utils.js', 'style-manager.js', 'metadata-manager.js',
        'text-markup.js', 'data-utils.js', 'series-manager.js', 'interaction-manager.js',
        'download-manager.js', 'controls-manager.js', 'mesa-explorer.js'
    ]
    
    for script in dev_scripts:
        content = re.sub(
            rf'^\s*<script src="/js/{script}"></script>',
            rf'\t\t<!-- <script src="/js/{script}"></script> -->',
            content,
            flags=re.MULTILINE
        )
    
    # Now group them back into multi-line comments as in the original structure
    # Group core utilities
    content = re.sub(
        r'(\t\t)<!-- <script src="/js/file-manager\.js"></script> -->\s*\n\s*<!-- <script src="/js/ui-utils\.js"></script> -->\s*\n\s*<!-- <script src="/js/style-manager\.js"></script> -->\s*\n\s*<!-- <script src="/js/metadata-manager\.js"></script> -->\s*\n\s*<!-- <script src="/js/text-markup\.js"></script> -->',
        r'\1<!-- <script src="/js/file-manager.js"></script>\n\t\t<script src="/js/ui-utils.js"></script>\n\t\t<script src="/js/style-manager.js"></script>\n\t\t<script src="/js/metadata-manager.js"></script>\n\t\t<script src="/js/text-markup.js"></script> -->',
        content
    )
    
    # Group UI management scripts
    content = re.sub(
        r'(\t\t)<!-- <script src="/js/series-manager\.js"></script> -->\s*\n\s*<!-- <script src="/js/interaction-manager\.js"></script> -->\s*\n\s*<!-- <script src="/js/download-manager\.js"></script> -->\s*\n\s*<!-- <script src="/js/controls-manager\.js"></script> -->',
        r'\1<!-- <script src="/js/series-manager.js"></script>\n\t\t<script src="/js/interaction-manager.js"></script>\n\t\t<script src="/js/download-manager.js"></script>\n\t\t<script src="/js/controls-manager.js"></script> -->',
        content
    )
    
    # Uncomment production scripts if they're commented
    production_scripts = [
        'file-manager.js', 'ui-utils.js', 'style-manager.js', 'metadata-manager.js',
        'text-markup.js', 'data-utils.js', 'series-manager.js', 'interaction-manager.js',
        'download-manager.js', 'controls-manager.js', 'mesa-explorer.js'
    ]
    
    for script in production_scripts:
        content = re.sub(
            rf'^\s*<!-- <script src="/mesa-explorer/js/{script}"></script> -->',
            rf'\t\t<script src="/mesa-explorer/js/{script}"></script>',
            content,
            flags=re.MULTILINE
        )
    
    with open('index.html', 'w') as f:
        f.write(content)
    
    print("Switched to production mode. Production scripts are now active.")

if __name__ == "__main__":
    switch_to_prod()