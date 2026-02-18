# Design System Guidelines

## Overview
Maya owns and maintains this design system.

## Typography

### Typography Tokens (MANDATORY)
All text styling MUST use design tokens.

**Location:** Configure in `.claude/config.json` → `design_system.location`

```scss
// ✅ Good
.heading {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-h1);
  font-weight: var(--font-weight-bold);
}

// ❌ Bad
.heading {
  font-size: 32px;
  line-height: 1.2;
  font-weight: 700;
}
```

### Language-Specific Typography
**English projects:** Font family per project, Direction: LTR
**Hebrew projects:** Hebrew font per project, Direction: RTL, RTL layout required

## Colors

### Color Tokens (MANDATORY)
NEVER hardcode colors. Always use variables.

**If design uses unknown color:**
1. STOP implementation
2. NOTIFY Ronen AND Maya
3. WAIT for Maya to add to design system

## Responsive Design

### Breakpoints
Standard breakpoints (customize per project):
- Mobile: 480px
- Tablet: 768px
- Laptop: 1200px
- Desktop: 1500px (customize)

### Responsive Mixins (MANDATORY)
NEVER hardcode media queries. Always use mixins.

## Mobile Spacing Defaults

When Maya has NOT provided mobile spacing, apply automatically:

| Element | Desktop | Mobile | Ratio |
|---------|---------|--------|-------|
| Page padding | 32-40px | 16-20px | ~50% |
| Form gap | 20-24px | 12-14px | ~60% |
| Card padding | 24-32px | 16px | ~50% |

## RTL Support (Hebrew Projects)

Required for Hebrew:
- `direction: rtl` on root
- Flip all horizontal spacing
- Mirror directional icons
- Text alignment: right

## Maya Approval Process

### What Requires Approval
1. New design tokens
2. Component visual changes
3. Responsive layout changes
4. Style system modifications

## Enforcement Checklist
- [ ] Typography tokens only
- [ ] Color variables only
- [ ] Responsive mixins used
- [ ] Mobile spacing applied
- [ ] RTL support (if Hebrew)
- [ ] Maya approval documented
