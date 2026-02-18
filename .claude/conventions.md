# Code Conventions & Standards

## File Size Management

### Limits (Configurable in config.json)
Default limits count ONLY executable code (exclude comments, headers, blank lines):

| File Type | Max Lines | Purpose |
|-----------|-----------|---------|
| Components (TSX/JSX) | 200 | UI components |
| Hooks | 100 | React hooks, composables |
| Utils | 150 | Utility functions |
| Services | 200 | API services, business logic |
| Controllers | 250 | Backend controllers |
| Styles (SCSS/CSS) | 200 | Style modules |

### Pre-Modification Protocol (MANDATORY)

**BEFORE modifying any file:**

1. **Check current line count:**
   ```bash
   wc -l filename.tsx
   ```

2. **Estimate lines you'll add:**
   - Small change: ~10-20 lines
   - Medium change: ~30-50 lines
   - Large change: ~60+ lines

3. **Apply decision matrix:**
   ```
   Current + Addition < 80% limit → Proceed
   Current + Addition 80-100% limit → Split first
   Current already > limit → Split immediately
   ```

4. **Example:**
   ```
   Current file: 150 lines
   Adding: ~40 lines
   Projected: 190 lines
   Limit: 200 lines
   Decision: 190 < 200 → Proceed (but close to limit)
   ```

### File Splitting Strategy

**Extract in this order:**

1. **Hooks** → `use*.ts` or `use*.tsx`
   ```
   useInventoryForm.ts
   useAuthValidation.ts
   ```

2. **Utils** → `*-utils.ts` or `*-helpers.ts`
   ```
   inventory-utils.ts
   date-helpers.ts
   ```

3. **Sub-components** → separate component files
   ```
   InventoryList.tsx → InventoryListItem.tsx
   ```

4. **Styles** → `.module.scss` files
   ```
   InventoryList.tsx → InventoryList.module.scss
   ```

5. **Main component last** → Keep main logic together

**After splitting:**
- ✅ Add modification headers to ALL new files
- ✅ Update ALL imports across codebase
- ✅ Verify functionality unchanged
- ✅ Run tests

---

## Naming Conventions

### Folders
```
kebab-case

✅ Good:
user-profile/
inventory-management/
auth-flow/

❌ Bad:
UserProfile/
inventory_management/
authFlow/
```

### Files

```
Components:     PascalCase.tsx
                UserProfile.tsx
                InventoryList.tsx

Hooks:          camelCase.ts
                useAuth.ts
                useInventory.ts

Utils:          camelCase.ts
                formatDate.ts
                apiHelpers.ts

Services:       camelCase.service.ts
                auth.service.ts
                inventory.service.ts

Styles:         ComponentName.module.scss
                UserProfile.module.scss
```

### Code Elements

```typescript
// Classes: PascalCase
class UserService {}
class InventoryManager {}

// Interfaces: PascalCase
interface UserProfile {}
interface InventoryItem {}

// Types: PascalCase
type UserRole = 'admin' | 'user';
type Status = 'active' | 'inactive';

// Variables/Functions: camelCase
const userData = [];
const inventoryItems = [];
function getUserById() {}
function calculateTotal() {}

// Constants: UPPER_SNAKE_CASE
const MAX_UPLOAD_SIZE = 5000000;
const API_BASE_URL = 'https://api.example.com';
```

---

## Modification Header (MANDATORY - Line 1 of Every Modified File)

### Standard Format

```typescript
/**
 * Modification Record
 *
 * Change ID:    <MANUAL_ID or AUTO>
 * Date:         <YYYY-MM-DD>
 * Modified By:  <Agent Name>
 *
 * Description:
 * <What changed and why - be specific>
 *
 * File Size Check:
 * - Current: <N> lines
 * - Adding: ~<N> lines
 * - Projected: <N> lines
 * - Decision: [Proceed | Split First | Split Immediately]
 *
 * Design System Compliance (if UI file):
 * - Typography tokens used: <e.g., --font-size-md, --line-height-normal, N/A>
 * - Color variables used: <e.g., --color-primary, --color-text, N/A>
 * - Responsive breakpoints: <e.g., mobile, tablet, desktop, N/A>
 * - Maya approval: [Pending | Approved | N/A]
 *
 * Language Verification (if UI file):
 * - Primary language: <from config.json>
 * - UI text verified: [Yes | Pending | N/A]
 * - RTL support: [Yes | No | N/A]
 * - Verified by: <Agent name or N/A>
 *
 * Related Files:
 * - <list ALL files affected by this change>
 */
```

### Header Rules

1. **MUST be line 1** of the file
2. **Never delete old headers** - newest always on top
3. **Required for EVERY modification** - no exceptions
4. **Stack multiple headers** chronologically (newest first)

### Example with Multiple Headers

```typescript
/**
 * Modification Record
 *
 * Change ID:    BR-15-003
 * Date:         2024-02-14
 * Modified By:  Maya
 *
 * Description:
 * Added mobile responsive breakpoints and reduced spacing for mobile
 *
 * File Size Check:
 * - Current: 180 lines
 * - Adding: ~15 lines
 * - Projected: 195 lines
 * - Decision: Proceed
 *
 * Design System Compliance:
 * - Typography tokens used: --font-size-sm, --line-height-normal
 * - Color variables used: --color-primary, --color-background
 * - Responsive breakpoints: mobile, tablet, desktop
 * - Maya approval: Approved
 *
 * Language Verification:
 * - Primary language: hebrew
 * - UI text verified: Yes
 * - RTL support: Yes
 * - Verified by: Maya, Lisa
 *
 * Related Files:
 * - PriceHistory.module.scss
 */

/**
 * Modification Record
 *
 * Change ID:    BR-15-002
 * Date:         2024-02-12
 * Modified By:  Mike
 *
 * Description:
 * Added price history display component
 *
 * File Size Check:
 * - Current: 0 lines (new file)
 * - Adding: ~180 lines
 * - Projected: 180 lines
 * - Decision: Proceed
 *
 * Related Files:
 * - PriceHistory.module.scss (new)
 * - InventoryDetail.tsx (imports this component)
 */

import React from 'react';
// ... component code
```

---

## Inline Change Comments (MANDATORY)

### Format
```typescript
// [YYYY-MM-DD] <Agent>: <reason>
```

### Examples

```typescript
// [2024-02-12] Ronen: Added user role validation for security
const validateRole = (role: string) => {
  // [2024-02-12] Ronen: Support admin and user roles only
  return ['admin', 'user'].includes(role);
};

// [2024-02-13] Maya: Changed to responsive grid layout
const Container = styled.div`
  display: grid;
  // [2024-02-13] Maya: Mobile gets single column
  grid-template-columns: 1fr 1fr 1fr;
  
  @include mobile {
    grid-template-columns: 1fr;
  }
`;
```

---

## Development Modes

Agents adapt behavior based on the current mode:

### Planning Mode
**Purpose:** Explore options and architecture  
**Output:** Options, tradeoffs, recommendations  
**No code generation**

```
Ronen: "Planning mode: How should we implement multi-language support?"

Response: 
Option A: i18n library (react-i18next)
  Pros: ...
  Cons: ...
  
Option B: Custom translation service
  Pros: ...
  Cons: ...

Recommendation: Option A because...
```

### Implementation Mode
**Purpose:** Write production code  
**Output:** Complete, tested, documented code  
**All rules enforced**

```
Mike: "Implementation mode: Create translation service"

Response:
[Creates files with headers, follows size limits, adds inline comments]
```

### Testing Mode
**Purpose:** Create tests and verify functionality  
**Output:** Test files, test commands, coverage reports

```
Lisa: "Testing mode: Test translation service"

Response:
[Creates test files, provides test commands, shows coverage]
```

### Debugging Mode
**Purpose:** Investigate and fix issues  
**Output:** Log analysis, root cause, fix proposals

```
Ronen: "Debugging mode: Why is translation failing?"

Response:
[Analyzes logs, identifies root cause, proposes fix with rationale]
```

---

## Git & Build Commands

### Permissions

**Michael ONLY** can execute:
- Git commands (commit, push, branch, merge)
- Build commands (npm run build, deployment scripts)
- Infrastructure commands

**Michael MUST:**
- Always ask Ronen for approval BEFORE executing
- Wait for explicit approval
- Confirm execution after completion

### Other Agents
- ❌ Cannot execute git/build commands
- ✅ Can SUGGEST commands
- ✅ Can prepare commit messages

### Example Flow

```
Michael: "Ready to execute: git commit -m 'Add user authentication'"
         
         WAITING FOR RONEN'S APPROVAL
         
Ronen: "Approved, proceed"

Michael: "Executing git commit... Done ✓"
```

---

## Cost Optimization Principles

**Goal:** Reduce costs through efficient code

### Strategies

1. **Smaller files = Lower cost**
   - Target: 15-20% cost savings
   - Keep files under size limits
   - Split proactively, not reactively

2. **Reuse over duplication**
   - Extract common logic to utils
   - Create shared components
   - Use hooks for shared state logic

3. **Efficient imports**
   - Import only what's needed
   - Avoid importing entire libraries
   ```typescript
   // ✅ Good
   import { format } from 'date-fns';
   
   // ❌ Bad
   import * as dateFns from 'date-fns';
   ```

---

## TypeScript Standards

### Explicit Types (ALWAYS)

```typescript
// ✅ Good
function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}

interface User {
  id: string;
  name: string;
  email: string;
}

// ❌ Bad
function calculateTotal(price, quantity) {
  return price * quantity;
}

const user = {
  id: '123',
  name: 'John'
};
```

### Async/Await Over Promises

```typescript
// ✅ Good
async function getUser(id: string): Promise<User> {
  const user = await userService.findById(id);
  return user;
}

// ❌ Bad
function getUser(id: string): Promise<User> {
  return userService.findById(id)
    .then(user => user);
}
```

### Proper Error Handling

```typescript
// ✅ Good
try {
  const result = await operation();
  return result;
} catch (error) {
  logger.error('Operation failed', error);
  throw new Error('Operation failed');
}

// ❌ Bad
const result = await operation(); // No error handling
```

### Interface vs Type

```typescript
// Use interface for objects that can be extended
interface User {
  id: string;
  name: string;
}

interface Admin extends User {
  permissions: string[];
}

// Use type for unions, primitives, tuples
type Status = 'active' | 'inactive' | 'pending';
type Coordinates = [number, number];
```

---

## Testing Standards

### Test Structure (AAA Pattern)

```typescript
describe('ComponentName', () => {
  describe('functionName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = 'test value';
      const expected = 'expected result';
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe(expected);
    });
    
    it('should handle edge case', () => {
      // Arrange
      const input = null;
      
      // Act & Assert
      expect(() => functionName(input)).toThrow();
    });
  });
});
```

### Coverage Requirements

- **Minimum:** 80% overall coverage
- **Critical paths:** 100% coverage
- **Run tests before commits:** Always

### Test File Naming

```
Component: UserProfile.tsx
Test file: UserProfile.test.tsx or UserProfile.spec.tsx

Hook: useAuth.ts  
Test file: useAuth.test.ts

Utils: formatDate.ts
Test file: formatDate.test.ts
```

---

## Security Standards

### Never Commit

❌ **NEVER commit these to version control:**
- API keys
- Passwords
- Database credentials
- JWT secrets
- Private keys
- Any secrets

### Always Use

✅ **ALWAYS use these practices:**
- Environment variables (`.env`)
- `.env.example` with dummy values
- Input validation
- Output sanitization
- Parameterized queries (prevent SQL injection)

### Example

```typescript
// ❌ Bad - Hardcoded secret
const JWT_SECRET = 'my-secret-key-123';

// ✅ Good - Environment variable
const JWT_SECRET = process.env.JWT_SECRET;

// ❌ Bad - No validation
function createUser(email: string) {
  // No validation
  db.insert({ email });
}

// ✅ Good - Validated
function createUser(email: string) {
  if (!isValidEmail(email)) {
    throw new Error('Invalid email');
  }
  db.insert({ email: sanitize(email) });
}
```

---

## Pre-Modification Checklist

Before modifying ANY file:

- [ ] File size checked (`wc -l filename`)
- [ ] Decision matrix applied (Proceed / Split First / Split Immediately)
- [ ] Modification header prepared
- [ ] Related files identified
- [ ] Design tokens verified (if UI file)
- [ ] Language verification plan (if UI file)
- [ ] No git/build commands (unless you're Michael with approval)

---

## During Modification Checklist

While modifying files:

- [ ] Header at line 1
- [ ] Inline date comments added
- [ ] Design system variables only (no hardcoded colors/fonts)
- [ ] Typography tokens used (if UI file)
- [ ] Responsive mixins used (if UI file)
- [ ] Language primary → fallback (if multi-language)
- [ ] Naming conventions followed

---

## Post-Modification Verification

After modifying files:

- [ ] File under size limit
- [ ] All imports updated (if files were split)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Tests passing
- [ ] Typography/design compliance verified (if UI file)
- [ ] Language verification complete (if UI file)
- [ ] No console errors

---

## When Splitting Files

If files exceed size limits:

- [ ] Headers added to ALL new files
- [ ] ALL imports updated across codebase
- [ ] Functionality unchanged (verify with tests)
- [ ] Typography/styles preserved
- [ ] Responsive behavior preserved
- [ ] Related files list updated in headers

---

**These conventions apply to ALL code modifications across ALL projects.**
