#!/usr/bin/env python3
"""Switch to development mode by enabling dev scripts and disabling production scripts."""

import re

def switch_to_dev():
    with open('index.html', 'r') as f:
        content = f.read()
    
    # Switch color-modes script
    # Comment out production color-modes if it's active
    content = re.sub(
        r'^\s*<script src="/mesa-explorer/js/color-modes\.js"></script>',
        r'\t<!-- <script src="/mesa-explorer/js/color-modes.js"></script> -->',
        content,
        flags=re.MULTILINE
    )
    # Uncomment development color-modes if it's commented
    content = re.sub(
        r'^\s*<!-- <script src="/js/color-modes\.js"></script> -->',
        r'\t<script src="/js/color-modes.js"></script>',
        content,
        flags=re.MULTILINE
    )
    
    # Handle production scripts - comment them out if they're active
    production_scripts = [
        'file-manager.js', 'ui-utils.js', 'style-manager.js', 'metadata-manager.js',
        'text-markup.js', 'data-utils.js', 'series-manager.js', 'interaction-manager.js',
        'download-manager.js', 'controls-manager.js', 'mesa-explorer.js'
    ]
    
    for script in production_scripts:
        content = re.sub(
            rf'^\s*<script src="/mesa-explorer/js/{script}"></script>',
            rf'\t\t<!-- <script src="/mesa-explorer/js/{script}"></script> -->',
            content,
            flags=re.MULTILINE
        )
    
    # Uncomment development scripts that are currently commented
    # Handle the multi-line comment block for core utilities
    content = re.sub(
        r'<!-- <script src="/js/file-manager\.js"></script>\s*\n\s*<script src="/js/ui-utils\.js"></script>\s*\n\s*<script src="/js/style-manager\.js"></script>\s*\n\s*<script src="/js/metadata-manager\.js"></script>\s*\n\s*<script src="/js/text-markup\.js"></script> -->',
        r'<script src="/js/file-manager.js"></script>\n\t\t<script src="/js/ui-utils.js"></script>\n\t\t<script src="/js/style-manager.js"></script>\n\t\t<script src="/js/metadata-manager.js"></script>\n\t\t<script src="/js/text-markup.js"></script>',
        content
    )
    
    # Handle data-utils
    content = re.sub(
        r'^\s*<!-- <script src="/js/data-utils\.js"></script> -->',
        r'\t\t<script src="/js/data-utils.js"></script>',
        content,
        flags=re.MULTILINE
    )
    
    # Handle the UI management multi-line comment
    content = re.sub(
        r'<!-- <script src="/js/series-manager\.js"></script>\s*\n\s*<script src="/js/interaction-manager\.js"></script>\s*\n\s*<script src="/js/download-manager\.js"></script>\s*\n\s*<script src="/js/controls-manager\.js"></script> -->',
        r'<script src="/js/series-manager.js"></script>\n\t\t<script src="/js/interaction-manager.js"></script>\n\t\t<script src="/js/download-manager.js"></script>\n\t\t<script src="/js/controls-manager.js"></script>',
        content
    )
    
    # Handle mesa-explorer
    content = re.sub(
        r'^\s*<!-- <script src="/js/mesa-explorer\.js"></script> -->',
        r'\t\t<script src="/js/mesa-explorer.js"></script>',
        content,
        flags=re.MULTILINE
    )
    
    with open('index.html', 'w') as f:
        f.write(content)
    
    print("Switched to development mode. Development scripts are now active.")

if __name__ == "__main__":
    switch_to_dev()