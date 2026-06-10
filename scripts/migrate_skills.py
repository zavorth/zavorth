import os
import re
import json
import shutil
import sys
import yaml

# Define Paths
SOURCE_ROOT = r"C:\Users\ermys\Downloads\AIAgentSkills"
TARGET_ROOT = r"c:\TESTES DEV\1_PROJETOS_ATIVOS\Zavorth\skill-library\native"
LOG_FILE = r"c:\TESTES DEV\1_PROJETOS_ATIVOS\Zavorth\migration_log.json"

# Brands Pattern
BRANDS_PATTERN = re.compile(r'\b(claude|anthropic|openai|gpt|google|nvidia)\b', re.IGNORECASE)

# Known developer/contributor usernames to sanitize globally
GLOBAL_USERNAMES = [
    "rudrankriyam", "muratcankoylan", "blader", "BehiSecc", 
    "VoltAgent", "K-Dense-AI", "coderabbitai", "orchestra-research",
    # Any other potential usernames found in directories
    "AgriciDaniel", "AvdLee", "BrianRWagner", "Charlie85270", "CloudAI-X", 
    "CosmoBlk", "Digidai", "Eronred", "EveryInc", "HeshamFS", "Joannis", 
    "Kevin7Qi", "LambdaTest", "Leonxlnx", "Lum1104", "MohamedAbdallah-14", 
    "NeoLabHQ", "NoizAI", "NotMyself", "Orchestra-Research", "PSPDFKit-labs", 
    "Paramchoudhary", "PleasePrompto", "ReScienceLab", "Rootly-AI-Labs", 
    "RoundTable02", "SHADOWPR0", "SeanZoR", "Xquik-dev", "ZhangHanDong", 
    "aklofas", "alinaqi", "angular", "antonbabenko", "awrshift", 
    "bitwize-music-studio", "conorluddy", "coreyhaines31", "cypress-io", 
    "czlonkowski", "deanpeters", "degausai", "dembrandt", "deusyu", 
    "efremidze", "ehmo", "ethos-link", "frmoretto", "fvadicamo", 
    "gitroomhq", "gokapso", "hanfang", "helius-labs", "honeydew-ai", 
    "hqhq1025", "huifer", "ibelick", "indranilbanerjee", "jthack", 
    "k-kolomeitsev", "komal-SkyNET", "kreuzberg-dev", "lackeyjb", 
    "lawvable", "makenotion", "massimodeluisa", "mattpocock", "mcollina", 
    "metalbear-co", "more-io", "mukul975", "mvanhorn", "nextlevelbuilder", 
    "obra", "ognjengt", "omkamal", "op7418", "openaccountants", "phuryn", 
    "prompt-security", "qdrant", "raintree-technology", "readme", "redis", 
    "resend", "robzolkos", "sanjay3290", "santifer", "scarletkc", "smixs", 
    "snyk", "takechanman1228", "talkstream", "testdino-hq", "transloadit", 
    "truongduy2611", "trycourier", "uucz", "veniceai", "video-db", 
    "wanshuiyin", "wrsmith108", "wshuyi", "yusufkaraaslan", "zarazhangrui", 
    "zechenzhangAGI", "zscole", "zw008", "zxkane"
]

USERNAMES_PATTERN = re.compile(rf'\b({"|".join(re.escape(u) for u in GLOBAL_USERNAMES)})\b', re.IGNORECASE)

def replace_brands(text):
    def replace_match(match):
        word = match.group(0)
        if word.isupper():
            return "ZAVORTH"
        elif word[0].isupper():
            return "Zavorth"
        else:
            return "zavorth"
    return BRANDS_PATTERN.sub(replace_match, text)

def replace_usernames(text):
    return USERNAMES_PATTERN.sub("Zavorth-Developer", text)

def sanitize_text(text, primary_username=None):
    if not text:
        return ""
    
    # 1. Sanitize primary username
    if primary_username:
        text = re.compile(re.escape(primary_username), re.IGNORECASE).sub("Zavorth-Developer", text)
        
    # 2. Sanitize global list of usernames
    text = replace_usernames(text)
    
    # 3. Sanitize brand names
    text = replace_brands(text)
    
    return text

def sanitize_value(val, primary_username=None):
    if isinstance(val, str):
        return sanitize_text(val, primary_username)
    elif isinstance(val, dict):
        return {sanitize_text(k, primary_username): sanitize_value(v, primary_username) for k, v in val.items()}
    elif isinstance(val, list):
        return [sanitize_value(item, primary_username) for item in val]
    else:
        return val

def parse_frontmatter(content):
    match = re.match(r'^---\s*\r?\n([\s\S]*?)\r?\n---', content)
    if not match:
        return {}, content
    
    frontmatter_text = match.group(1)
    body_text = content[match.end():]
    
    try:
        fields = yaml.safe_load(frontmatter_text)
        if not isinstance(fields, dict):
            fields = {}
    except Exception as e:
        print(f"Error parsing YAML frontmatter: {e}")
        fields = {}
        
    return fields, body_text

def build_skill_md(fields, body):
    try:
        frontmatter_text = yaml.safe_dump(fields, sort_keys=False, allow_unicode=True, default_flow_style=False)
        return "---\n" + frontmatter_text.strip() + "\n---\n\n" + body.lstrip()
    except Exception as e:
        print(f"Error serialization YAML frontmatter: {e}")
        frontmatter_lines = ["---"]
        for k, v in fields.items():
            v_clean = str(v).replace('"', '\\"').strip()
            frontmatter_lines.append(f'{k}: "{v_clean}"')
        frontmatter_lines.append("---")
        return "\n".join(frontmatter_lines) + "\n\n" + body.lstrip()

def clean_name_field(original_name, sanitized_folder_name):
    if not original_name:
        return " ".join(w.capitalize() for w in sanitized_folder_name.split('-'))
    
    cleaned = original_name
    brands = ['claude', 'anthropic', 'openai', 'gpt', 'google', 'nvidia']
    for brand in brands:
        cleaned = re.sub(rf'\b{brand}\b', '', cleaned, flags=re.IGNORECASE)
    
    suffixes = ['skills', 'skill', 'plugins', 'plugin', 'kits', 'kit']
    for suffix in suffixes:
        cleaned = re.sub(rf'\b{suffix}\b', '', cleaned, flags=re.IGNORECASE)
    
    cleaned = re.sub(r'[-_/\s]+', ' ', cleaned).strip()
    words = [w.capitalize() for w in cleaned.split() if w]
    if not words:
        words = [w.capitalize() for w in sanitized_folder_name.split('-')]
    
    return " ".join(words)

def clean_kebab_case(name, username=None):
    if username and name.lower().startswith(username.lower() + '_'):
        name = name[len(username) + 1:]
    name = re.sub(r'^[a-zA-Z0-9-]{2,}_', '', name)
    
    name = name.lower()
    name = re.sub(r'[^a-z0-9]+', '-', name)
    name = name.strip('-')
    
    words = name.split('-')
    brands = {'claude', 'anthropic', 'google', 'nvidia', 'openai', 'gpt'}
    suffixes = {'skill', 'skills', 'plugin', 'plugins', 'kit', 'kits'}
    
    filtered_words = [w for w in words if w not in brands and w not in suffixes]
    
    if not filtered_words:
        filtered_words = [w for w in words if w not in brands]
        if not filtered_words:
            filtered_words = words
            
    return '-'.join(filtered_words)

def copy_and_sanitize(src_dir, dst_dir, username):
    os.makedirs(dst_dir, exist_ok=True)
    for item in os.listdir(src_dir):
        if item in ('.git', '.gitignore', 'SKILL.md'):
            continue
        
        src_path = os.path.join(src_dir, item)
        dst_path = os.path.join(dst_dir, item)
        
        if os.path.isdir(src_path):
            copy_and_sanitize(src_path, dst_path, username)
        else:
            is_text = False
            content = None
            try:
                with open(src_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                is_text = True
            except UnicodeDecodeError:
                is_text = False
            except OSError as e:
                print(f"Failed to read text file {src_path}: {e}")
                is_text = False
            
            if is_text and content is not None:
                sanitized_content = sanitize_text(content, username)
                with open(dst_path, 'w', encoding='utf-8') as f:
                    f.write(sanitized_content)
            else:
                try:
                    shutil.copy2(src_path, dst_path)
                except Exception as e:
                    print(f"Failed to copy binary file {src_path}: {e}")

def main():
    print("Initializing migration script...")
    
    # 1. Find all existing native skill folder names to prevent collisions
    used_folder_names = {}
    if os.path.exists(TARGET_ROOT):
        for entry in os.listdir(TARGET_ROOT):
            if os.path.isdir(os.path.join(TARGET_ROOT, entry)):
                used_folder_names[entry.lower()] = True
    print(f"Loaded {len(used_folder_names)} existing native skill folders to prevent overwrite.")

    # 2. Discover skill directories containing SKILL.md under SOURCE_ROOT
    print(f"Scanning {SOURCE_ROOT} for skill directories containing SKILL.md...")
    skill_dirs = []
    for root, dirs, files in os.walk(SOURCE_ROOT):
        if 'SKILL.md' in files:
            skill_dirs.append(root)
            
    print(f"Found {len(skill_dirs)} skill directories.")
    
    migrations = []
    collisions = []
    migrated_count = 0
    
    for i, skill_dir in enumerate(skill_dirs):
        try:
            # Get folder name containing SKILL.md
            folder_name = os.path.basename(skill_dir)
            
            # Extract author username from ancestors if under downloaded_repositories
            username = None
            parts = os.path.normpath(skill_dir).split(os.sep)
            for idx, part in enumerate(parts):
                if part == 'downloaded_repositories' and idx + 1 < len(parts):
                    repo_folder = parts[idx + 1]
                    if '_' in repo_folder:
                        username = repo_folder.split('_')[0]
                    break
            
            # Sanitize folder name
            base_name = clean_kebab_case(folder_name, username)
            
            # Resolve collisions
            collision = False
            resolved_name = base_name
            if resolved_name.lower() in used_folder_names:
                collision = True
                suffix_counter = 1
                while f"{base_name}-{suffix_counter}".lower() in used_folder_names:
                    suffix_counter += 1
                resolved_name = f"{base_name}-{suffix_counter}"
            
            used_folder_names[resolved_name.lower()] = True
            
            # Destination directory
            dst_dir = os.path.join(TARGET_ROOT, resolved_name)
            
            # Process SKILL.md
            skill_md_src = os.path.join(skill_dir, 'SKILL.md')
            with open(skill_md_src, 'r', encoding='utf-8', errors='ignore') as f:
                skill_content = f.read()
            
            frontmatter, body = parse_frontmatter(skill_content)
            
            # Title case clean name
            orig_name = frontmatter.get('name', '')
            clean_title_name = clean_name_field(orig_name, resolved_name)
            
            # Sanitize description
            orig_desc = frontmatter.get('description', '')
            clean_desc = sanitize_text(orig_desc, username).strip()
            if not clean_desc:
                clean_desc = f"Migrated Zavorth skill for {clean_title_name}."
            
            # Build new frontmatter
            new_frontmatter = {
                'name': clean_title_name,
                'description': clean_desc,
                'license': 'Zavorth-Internal'
            }
            # Preserve other frontmatter keys if they are not name, description, license
            for k, v in frontmatter.items():
                if k not in ('name', 'description', 'license'):
                    clean_k = sanitize_text(k, username)
                    clean_v = sanitize_value(v, username)
                    new_frontmatter[clean_k] = clean_v
            
            # Sanitize body
            sanitized_body = sanitize_text(body, username)
            
            # Write new SKILL.md
            os.makedirs(dst_dir, exist_ok=True)
            skill_md_dst = os.path.join(dst_dir, 'SKILL.md')
            with open(skill_md_dst, 'w', encoding='utf-8') as f:
                f.write(build_skill_md(new_frontmatter, sanitized_body))
                
            # Copy and sanitize support files/folders
            copy_and_sanitize(skill_dir, dst_dir, username)
            
            # Generate ZAVORTH_NATIVE_SKILL.json
            native_json = {
                "id": resolved_name,
                "name": clean_title_name,
                "native": True,
                "description": clean_desc,
                "category": "utility",
                "permissionProfileId": "local-readonly",
                "riskLevel": "low",
                "capabilityTags": ["migrated"],
                "presets": ["basic", "developer"],
                "inputContract": [],
                "outputContract": [],
                "noExecutionByDefault": True,
                "requiresPolicyBroker": True,
                "receiptsRequired": True
            }
            
            json_dst = os.path.join(dst_dir, 'ZAVORTH_NATIVE_SKILL.json')
            with open(json_dst, 'w', encoding='utf-8') as f:
                json.dump(native_json, f, indent=2)
            
            # Log migration
            migrations.append({
                "original_path": skill_dir,
                "new_path": dst_dir,
                "collision": collision,
                "original_folder_name": folder_name,
                "resolved_folder_name": resolved_name
            })
            
            if collision:
                collisions.append({
                    "original_path": skill_dir,
                    "requested_name": base_name,
                    "resolved_name": resolved_name
                })
                
            migrated_count += 1
            if migrated_count % 200 == 0:
                print(f"Migrated {migrated_count}/{len(skill_dirs)} skills...")
                
        except Exception as e:
            print(f"Error migrating skill from {skill_dir}: {e}")
            
    # Write migration log
    log_data = {
        "total_migrated": migrated_count,
        "migrations": migrations,
        "collisions": collisions
    }
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, indent=2)
        
    print(f"Migration completed successfully! Total skills migrated: {migrated_count}. Collisions: {len(collisions)}.")

if __name__ == "__main__":
    main()
