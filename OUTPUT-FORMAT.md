# OUTPUT-FORMAT.md - Response Formatting

How the agent should format responses for different contexts.

## Format Rules

### Code

- **Format:** complete file with language identifier
- **Include examples:** yes
- **Use bullet points:** no
- **Use tables:** no

### Explanation

- **Format:** answer first, then explanation
- **Include examples:** yes
- **Use bullet points:** yes
- **Use tables:** no

### Summary

- **Format:** max 3 sentences, key takeaways
- **Include examples:** no
- **Use bullet points:** yes
- **Use tables:** no

### Comparison

- **Format:** structured comparison
- **Include examples:** yes
- **Use bullet points:** yes
- **Use tables:** yes

### Debugging

- **Format:** error, cause, fix
- **Include examples:** yes
- **Use bullet points:** yes
- **Use tables:** no

### Documentation

- **Format:** headers, sections, examples
- **Include examples:** yes
- **Use bullet points:** yes
- **Use tables:** yes

## File boundary

What belongs here:
- format preferences per output context
- example/table/bullet preferences

What does not belong here:
- behavioral rules (RULES.md)
- personality traits (SOUL.md)

## Maintenance rule

When formatting preferences change, update this file.
