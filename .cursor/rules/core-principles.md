# Core Principles

## Guiding Philosophy

- **Simplicity Over Complexity**: Always prioritize simple solutions over complex ones
- **YAGNI (You Aren't Gonna Need It)**: Don't add patterns until they're actually needed
- **Single Responsibility**: Each class, function, and module should have one clear purpose
- **Testability**: Write code that can be easily tested in isolation
- **Maintainability**: Code should be easy to read, understand, and modify

## Design Guidelines

1. **Start Simple**: Begin with the simplest solution that works
2. **Refactor When Needed**: Only add abstraction when you see duplication or complexity
3. **Explicit Over Implicit**: Make dependencies and behavior clear
4. **Fail Fast**: Validate early and throw meaningful errors
5. **Document Why, Not What**: Code should be self-documenting; comments explain reasoning

## Code Quality Standards

- TypeScript strict mode must be enabled
- No `any` types allowed (use `unknown` if type is truly unknown)
- No `@ts-ignore` comments (fix the underlying issue)
- All functions should have explicit return types
- Prefer functional programming patterns where appropriate
