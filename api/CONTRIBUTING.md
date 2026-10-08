# Contributing to WhatsApp Company Assistant

Thank you for considering contributing to the WhatsApp Company Assistant! This document provides guidelines and instructions for contributing.

## 🌟 Ways to Contribute

### 1. Report Bugs
Found a bug? Help us fix it!

**Before reporting:**
- Check if the bug has already been reported in [Issues](https://github.com/yourusername/whatsapp-company-assistant/issues)
- Test on the latest version
- Collect error logs from `logs/combined.log`

**Bug Report Template:**
```markdown
### Description
Clear description of the bug

### Steps to Reproduce
1. Step one
2. Step two
3. Step three

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Environment
- OS: [e.g., Windows 11]
- Node Version: [e.g., 18.17.0]
- Package Version: [e.g., 1.0.0]

### Logs
```
Paste relevant error logs here
```
```

### 2. Suggest Features
Have an idea? We'd love to hear it!

**Feature Request Template:**
```markdown
### Feature Description
Clear description of the feature

### Problem It Solves
What problem does this solve?

### Proposed Solution
How should it work?

### Alternatives Considered
What other approaches did you consider?

### Additional Context
Screenshots, mockups, examples
```

### 3. Improve Documentation
Documentation improvements are always welcome!

- Fix typos
- Clarify confusing sections
- Add examples
- Translate to other languages
- Write tutorials

### 4. Submit Code
Ready to code? Here's how:

## 🔨 Development Setup

### Fork and Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/whatsapp-company-assistant.git
cd whatsapp-company-assistant

# Add upstream remote
git remote add upstream https://github.com/yourusername/whatsapp-company-assistant.git
```

### Install Dependencies

```bash
npm install
```

### Setup Development Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Use test/development credentials
```

### Run in Development Mode

```bash
npm run dev
```

## 📝 Coding Guidelines

### Code Style

We use ESLint for code style. Run before committing:

```bash
npm run lint
```

**General Rules:**
- Use ES6+ features
- Async/await for promises
- Meaningful variable names
- Comment complex logic
- Keep functions small and focused

**Example:**
```javascript
// ❌ Bad
async function f(d) {
  return await db.query(d);
}

// ✅ Good
async function getUserById(userId) {
  // Query database for user
  const user = await database.users.findOne({ id: userId });
  return user;
}
```

### File Structure

```
src/
├── core/          # Core functionality (WhatsApp, AI, Knowledge)
├── modules/       # Business modules (customer-service, sales, etc.)
├── utils/         # Utility functions
├── models/        # Database models
├── routes/        # API routes
└── middleware/    # Express middleware
```

### Naming Conventions

- **Files**: camelCase (e.g., `messageHandler.js`)
- **Classes**: PascalCase (e.g., `class AIEngine`)
- **Functions**: camelCase (e.g., `function processMessage()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `const MAX_RETRIES`)
- **Private functions**: Prefix with `_` (e.g., `_internalHelper()`)

### Error Handling

Always handle errors properly:

```javascript
// ✅ Good
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed:', error);
  throw new CustomError('User-friendly message');
}

// ❌ Bad
const result = await riskyOperation(); // No error handling
```

### Logging

Use Winston logger:

```javascript
import logger from './utils/logger.js';

logger.info('Operation successful', { userId, action });
logger.warn('Unusual activity detected', { details });
logger.error('Operation failed', { error: error.message, stack: error.stack });
```

### Testing

Write tests for new features:

```javascript
describe('AIEngine', () => {
  it('should generate response', async () => {
    const engine = new AIEngine();
    const response = await engine.generateResponse({
      message: 'Hello',
      context: {}
    });
    expect(response.text).toBeDefined();
  });
});
```

Run tests:
```bash
npm test
```

## 🔄 Git Workflow

### Branching Strategy

- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical fixes

### Commit Messages

Follow conventional commits:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build, dependencies, etc.

**Examples:**
```
feat(ai): add load balancing support

Implements round-robin load balancing across multiple AI providers
to optimize costs and reliability.

Closes #123

---

fix(whatsapp): handle disconnect gracefully

Adds retry logic and proper error messages when WhatsApp disconnects.

---

docs(readme): update installation instructions

Clarifies MongoDB setup steps for Windows users.
```

### Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/my-awesome-feature
   ```

2. **Make Changes**
   - Write code
   - Add tests
   - Update documentation
   - Run linter: `npm run lint`
   - Run tests: `npm test`

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Keep Branch Updated**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/my-awesome-feature
   ```

6. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Fill out the template
   - Link related issues

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe your testing process

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added
- [ ] All tests pass
- [ ] Dependent changes merged

## Screenshots (if applicable)
```

## 🧪 Testing Guidelines

### Unit Tests

Test individual functions:

```javascript
import { formatPhoneNumber } from './utils/helpers.js';

describe('formatPhoneNumber', () => {
  it('should format US phone numbers', () => {
    expect(formatPhoneNumber('5551234567')).toBe('+1-555-123-4567');
  });
  
  it('should handle invalid input', () => {
    expect(formatPhoneNumber('invalid')).toBe(null);
  });
});
```

### Integration Tests

Test module interactions:

```javascript
describe('Message Processing', () => {
  it('should process and respond to message', async () => {
    const handler = new MessageHandler(mockAIEngine);
    const response = await handler.processMessage({
      from: 'user@phone',
      body: 'Hello'
    });
    expect(response).toBeDefined();
  });
});
```

### Manual Testing

Always manually test:
1. Send test messages
2. Check logs for errors
3. Verify expected behavior
4. Test edge cases

## 📚 Documentation Guidelines

### Code Documentation

Use JSDoc for functions:

```javascript
/**
 * Generate AI response for user message
 * @param {Object} params - Parameters
 * @param {string} params.message - User message
 * @param {Object} params.context - Conversation context
 * @returns {Promise<Object>} AI response with text and metadata
 * @throws {AIProviderError} When all providers fail
 */
async function generateResponse(params) {
  // Implementation
}
```

### README Updates

When adding features:
- Update feature list
- Add configuration examples
- Include usage examples
- Update API documentation

### Changelog

Update `CHANGELOG.md`:

```markdown
## [1.2.0] - 2024-01-15

### Added
- Load balancing across multiple AI providers
- Support for Hermes 3B local model
- New analytics dashboard

### Changed
- Improved error handling in WhatsApp client
- Updated OpenAI SDK to v4

### Fixed
- Session timeout issue (#45)
- Memory leak in knowledge base (#52)
```

## 🎨 Design Principles

### 1. Modularity
Keep components independent and reusable

### 2. Extensibility
Easy to add new features without breaking existing code

### 3. Performance
Optimize for response time and resource usage

### 4. Reliability
Graceful error handling and fallbacks

### 5. Security
Input validation, sanitization, secure defaults

### 6. Simplicity
Clear, readable code over clever solutions

## 🏆 Recognition

Contributors will be:
- Listed in `CONTRIBUTORS.md`
- Mentioned in release notes
- Acknowledged in README

## ❓ Questions?

- 💬 [GitHub Discussions](https://github.com/yourusername/whatsapp-company-assistant/discussions)
- 📧 Email: contribute@yourcompany.com
- 💬 [Discord](https://discord.gg/yourserver)

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone.

### Our Standards

**Positive behavior:**
- Using welcoming language
- Respecting differing viewpoints
- Accepting constructive criticism
- Focusing on what's best for the community

**Unacceptable behavior:**
- Harassment or discriminatory language
- Trolling or insulting comments
- Public or private harassment
- Publishing others' private information

### Enforcement

Report issues to: conduct@yourcompany.com

---

**Thank you for contributing!** 🙏

Your contributions make this project better for everyone.
