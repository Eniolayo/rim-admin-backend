# Cursor Rules Directory

This directory contains modular development rules for the RIM Backend project. These rules are automatically applied to every conversation through the `project.mdc` file.

## Structure

```
.cursor/
├── rules/
│   ├── project.mdc              # Main MDC file that references all rules
│   ├── README.md                # This file
│   ├── core-principles.md       # Core development philosophy
│   ├── module-organization.md   # Module structure and organization
│   ├── dependency-injection.md  # DI best practices
│   ├── dtos-validation.md       # DTO and validation patterns
│   ├── error-handling.md        # Error handling strategies
│   ├── database-orm.md          # TypeORM best practices
│   ├── database-schema.md       # Schema compliance rules
│   ├── performance.md           # Performance optimization
│   ├── configuration.md         # Configuration management
│   ├── security.md              # Security best practices
│   ├── code-style.md            # Code style and patterns
│   ├── logging.md               # Logging best practices
│   ├── anti-patterns.md         # Common mistakes to avoid
│   └── checklist.md             # Pre-commit checklist
└── (optional: .cursorrules)     # Legacy single-file rules
```

## How It Works

### MDC (Markdown Context) Files

The `project.mdc` file uses Cursor's MDC feature with `alwaysApply: true`, which means:

- The rules are **automatically included** in every conversation
- You don't need to manually reference them
- All rule files are loaded through the `@.cursor/rules/filename.md` syntax (full relative paths)

### Benefits of Modular Structure

1. **Maintainability**: Each rule category is in its own file
2. **Clarity**: Easy to find and update specific rules
3. **Scalability**: Add new rule files without cluttering a single large file
4. **Selective Loading**: Can reference individual files when needed
5. **Version Control**: Easier to track changes to specific rule categories

## Usage

### For AI Assistant

The rules are automatically applied to every conversation. No action needed!

### For Developers

When you need to:

1. **Update a specific rule category**:
   - Edit the appropriate `.md` file
   - Changes apply immediately to new conversations

2. **Add a new rule category**:
   - Create a new `.md` file in this directory
   - Add reference in `project.mdc` using `@.cursor/rules/new-file.md`

3. **Reference a specific rule in code review**:
   - Link to the specific `.md` file
   - Example: "See `security.md` section on password hashing"

4. **Disable a rule temporarily**:
   - Comment out the `@.cursor/rules/filename.md` line in `project.mdc`
   - Or remove it temporarily

## Rule Categories

### Core Development

- **core-principles.md**: YAGNI, simplicity, testability
- **module-organization.md**: File structure, module dependencies
- **dependency-injection.md**: DI patterns and scopes

### Data & Validation

- **dtos-validation.md**: DTO creation, validation decorators
- **error-handling.md**: Exception handling patterns
- **database-orm.md**: TypeORM query optimization
- **database-schema.md**: Schema compliance (CRITICAL!)

### Performance & Config

- **performance.md**: Caching, async operations, background jobs
- **configuration.md**: Environment variables, type-safe config

### Security & Quality

- **security.md**: Authentication, authorization, input sanitization
- **code-style.md**: Naming conventions, code organization
- **logging.md**: Proper logging practices
- **anti-patterns.md**: Common mistakes to avoid

### Workflow

- **checklist.md**: Pre-commit verification checklist

## Critical Rules

### 🔴 ALWAYS Remember

1. Read `docs/boooster_complete_schema.md` before database work
2. Never write migrations manually (use TypeORM generation)
3. Validate all inputs with DTOs
4. Never use `any` type
5. Use NestJS Logger instead of console.log

### 🔴 NEVER Do

1. Put business logic in controllers
2. Create circular dependencies
3. Commit secrets or credentials
4. Block the event loop with sync operations
5. Bypass dependency injection

## Maintenance

### Adding New Rules

```markdown
1. Create new file: `.cursor/rules/new-category.md`
2. Add reference in `project.mdc`:

   ## New Category

   @.cursor/rules/new-category.md

3. Commit changes
```

### Updating Existing Rules

```markdown
1. Edit the appropriate `.md` file
2. Ensure examples are clear and correct
3. Update related rules if needed
4. Test with a new conversation to verify
```

### Best Practices for Rule Files

- **Be Specific**: Include code examples
- **Show Both**: Good and bad examples
- **Stay Current**: Update as patterns evolve
- **Cross-Reference**: Link related rules
- **Test Examples**: Ensure code examples work

## Migration from `.cursorrules`

If you have an existing `.cursorrules` file:

1. Keep it for backward compatibility (optional)
2. The `project.mdc` takes precedence
3. Can delete `.cursorrules` once verified MDC works
4. MDC provides better organization and maintainability

## Testing Rules

To verify rules are applied:

1. Start a new conversation
2. Ask: "What are the rules for creating a new module?"
3. AI should reference the specific rule files
4. Check if responses follow the guidelines

## Questions?

- Rules not applying? Check `project.mdc` syntax
- Need to add project-specific rules? Create new `.md` file
- Rules conflicting? Review and consolidate
- Want to disable? Comment out in `project.mdc`

## Last Updated

Check git history for latest updates to rule files.
