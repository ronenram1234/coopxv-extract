# Language Verification Protocol

## Purpose
Ensure all user-facing text appears in correct primary language.

## When This Applies

### English Projects
- UI text in English
- RTL: No

### Hebrew Projects
- UI text in Hebrew FIRST
- Fallback: English (secondary)
- RTL: Yes (MANDATORY)

## Agents Responsible

**Primary Verifiers:**
1. Maya - ALL UI text
2. Shira - Requirements docs
3. Mark - Presentations
4. Lisa - Test UI text

## UI Text Categories (ALL must be verified)
- Page titles
- Field labels
- Button text
- Error messages
- Tooltips
- Placeholder text
- Navigation items

## Verification Process

### Step 1: Maya Creates Checklist
```markdown
Component: ComponentName
Primary Language: hebrew

UI Text:
- [ ] Page title: "כותרת הדף"
- [ ] Button: "שלח"
- [ ] Error: "שגיאה"
```

### Step 2: Implementation
```typescript
// Hebrew project
const buttonText = "שלח";  // Primary
const errorText = "שגיאה"; // Primary

// English fallback
const buttonTextEN = "Submit";
```

### Step 3: Maya Reviews
- [ ] All text in primary language
- [ ] Grammar correct
- [ ] RTL layout works

### Step 4: Lisa Tests
- [ ] Text displays correctly
- [ ] No English leaking
- [ ] Fits in UI elements

## RTL Requirements (Hebrew/Arabic)

```scss
html[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

.button {
  margin-left: 16px;

  @include rtl {
    margin-left: 0;
    margin-right: 16px;
  }
}
```

## Modification Header

```typescript
/**
 * Language Verification:
 * - Primary language: hebrew
 * - UI text verified: Yes
 * - RTL support: Yes
 * - Verified by: Maya, Lisa
 */
```

## Common Mistakes

### ❌ English on Hebrew Project
Bad: `<button>Submit</button>`
Good: `<button>שלח</button>`

### ❌ LTR on Hebrew
Bad: `text-align: left;`
Good: `text-align: right;`

## Enforcement
- ❌ English text on Hebrew UI → Rejected
- ❌ Missing RTL → Rejected
- ❌ Text overflow → Fix required
