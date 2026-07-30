# Design: Hardening `setNested` against Prototype Pollution

## Overview

Sanitize input keys in `setNested` to prevent prototype pollution vulnerability (Code Scanning alert #2 / PR #350).

## Architecture & Data Flow

1. Split input key by `.` delimiter into `parts`.
2. Check if `parts` contains empty strings or matches `Set(['__proto__', 'constructor', 'prototype'])`.
3. Early-return if unsafe or empty.
4. Traverse and mutate `obj` safely.
