---
name: Remotion Video Compiler
description: Compile programmatic videos and animations using Remotion scripts locally.
license: Zavorth-Internal
---

# Remotion Video Compiler

Use this native skill when:
- The task requires operations in the 'media' domain.
- Performing actions matching: compile programmatic videos and animations using remotion scripts locally.

## Operating Rules

- Validate Javascript video configurations before rendering.
- Run render processes inside bounded subprocess queues.
- Generate output streams within target output folders.

## Output

Return path to rendered video, encoding metrics, and logs.
