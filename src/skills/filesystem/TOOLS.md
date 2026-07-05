# Filesystem Tools

Tools for working with local files and directories on the host machine.

## Available Tools

### `read_file`
Reads the contents of a text file. Accepts absolute or relative paths.
- Limit: 2MB per file, truncated to 15k characters
- Use when the user asks to view, open, or read a file

### `create_file`
Creates a new file with the specified content.
- Security: files are created only inside the `output/` folder
- Use when the user asks to generate, write, or save a file

### `list_directory`
Lists the contents of a directory, including files and subfolders.
- Use when the user asks to see what is inside a folder
- If no path is provided, lists the current working directory

## When Not To Use

- For internet searches, use the `information` skill
