import os
import re

src_dir = r"C:\TESTES DEV\1_PROJETOS_ATIVOS\Zavorth\src"
pattern = re.compile(r'((?:import\s+(?:type\s+)?)\{\s*\n?)\s*(import\s*\{\s*logger\s*\}\s*from\s*[\'"][^\'"]+[\'"];?)\s*\n?', re.MULTILINE)

modified_files = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'import { logger }' in content:
                new_content, count = pattern.subn(r'\2\n\1', content)
                if count > 0:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    modified_files.append(filepath)
                    print(f"Fixed {filepath} ({count} replacements)")

print(f"Done. Modified {len(modified_files)} files.")
