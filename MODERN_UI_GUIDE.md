# TriTech Hub iOS — Modern UI System

A professional, contemporary design system using TailwindCSS. All pages now feature:
- Dark gradient backgrounds
- Glassmorphism cards (frosted glass effect)
- Smooth animations and transitions
- Professional typography
- Modern form inputs
- Clean component hierarchy

## Updated Pages ✅

- **Login** — Modern authentication page with logo display
- **Admin Settings** — Professional settings interface with maintenance mode toggle
- **Splash Screen** — Updated with modern aesthetics
- **Maintenance Screen** — Glassmorphic design with animated orbs
- **Admin Dashboard** — (Ready for modernization)
- **Staff/Customer Pages** — (Ready for modernization)

## Modern Components

Located in `frontend/src/components/Modern/`:

### Button Component
```jsx
import Button from '../components/Modern/Button'

<Button variant="primary" size="md" loading={isLoading}>
  Click me
</Button>
```

**Variants:**
- `primary` — Green gradient, main action
- `secondary` — White/transparent, secondary action
- `danger` — Red gradient, destructive action
- `ghost` — Minimal, text only

**Sizes:**
- `sm` — Small buttons
- `md` — Medium (default)
- `lg` — Large buttons

### Card Component
```jsx
import Card from '../components/Modern/Card'

<Card glass padding="p-6" className="mb-4">
  Content here
</Card>
```

**Props:**
- `glass` — Glassmorphism effect (default: true)
- `padding` — TailwindCSS padding class (default: `p-6`)

### Input Component
```jsx
import Input from '../components/Modern/Input'

<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  error={errorMessage}
/>
```

## Color Palette

**Primary Colors:**
- Emerald: `#10b981` (emerald-500) — Action buttons, highlights
- Dark bg: `#0f172a` (slate-900) — Page background
- White/Glass: `rgba(255,255,255,0.1)` — Cards with glassmorphism

**Semantic Colors:**
- Success: `#10b981` (emerald)
- Error: `#ef4444` (red)
- Warning: `#f59e0b` (amber)
- Info: `#3b82f6` (blue)

**Text:**
- Primary: `white` or `#ffffff`
- Secondary: `#d1d5db` (gray-300)
- Muted: `#9ca3af` (gray-400)

## Design Patterns

### Background
```jsx
// Dark gradient with animated orbs
<div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
  {/* Animated orbs for visual interest */}
  <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
</div>
```

### Cards (Glassmorphism)
```jsx
<Card glass padding="p-6 sm:p-8" className="mb-6">
  {/* Content with frosted glass effect */}
</Card>
```

### Forms
```jsx
<form className="space-y-5">
  <Input label="Field name" />
  <Input label="Another field" />
  <Button type="submit" className="w-full">
    Submit
  </Button>
</form>
```

### Modals
```jsx
{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <Card glass padding="p-8" className="w-full max-w-sm">
      {/* Modal content */}
    </Card>
  </div>
)}
```

## Updating Other Pages

### Step 1: Import Modern Components
```jsx
import Button from '../../components/Modern/Button'
import Card from '../../components/Modern/Card'
import Input from '../../components/Modern/Input'
```

### Step 2: Update Background
Replace:
```jsx
style={{ background: '#0b1410' }}
```

With:
```jsx
className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen"
```

### Step 3: Replace Forms
Old:
```jsx
<input className="w-full px-4 py-2 border border-gray-200 rounded" />
```

New:
```jsx
<Input label="Label" placeholder="..." />
```

### Step 4: Replace Buttons
Old:
```jsx
<button className="px-4 py-2 bg-green-800 text-white">Click</button>
```

New:
```jsx
<Button variant="primary">Click</Button>
```

### Step 5: Replace Cards
Old:
```jsx
<div className="bg-white rounded-lg p-4 shadow-md">
```

New:
```jsx
<Card glass padding="p-6">
```

## Pages to Modernize

### High Priority
- [ ] Admin Dashboard (`/admin/dashboard`)
- [ ] Customers (`/admin/customers`)
- [ ] Customer Detail (`/admin/customers/:id`)
- [ ] Staff Management (`/admin/staff`)

### Medium Priority
- [ ] Staff Dashboard
- [ ] Customer Dashboard
- [ ] Transactions
- [ ] Reports

### Low Priority
- [ ] About pages
- [ ] Search pages
- [ ] Audit Logs

## Typography

```jsx
// Headings
<h1 className="text-4xl font-black text-white">Large Title</h1>
<h2 className="text-2xl font-bold text-white">Section Title</h2>
<h3 className="text-lg font-bold text-white">Card Title</h3>

// Body Text
<p className="text-base text-gray-300">Body text</p>
<p className="text-sm text-gray-400">Secondary text</p>
<p className="text-xs text-gray-500">Muted text</p>

// Labels
<label className="text-sm font-semibold text-gray-700">Label</label>
```

## Spacing System

```jsx
// Use consistent spacing
<div className="space-y-4"> {/* 16px gap between items */}
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Cards and sections
<Card padding="p-6 sm:p-8"> {/* 24px on mobile, 32px on desktop */}
  Content
</Card>

// Margin between sections
<div className="mb-6"> {/* 24px margin below */}
```

## Animations

```jsx
// Pulse effect
<div className="animate-pulse" />

// Fade in
<div style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}>
  Content
</div>

// Hover scale
<button className="hover:scale-105 transition-transform">
  Hover me
</button>
```

## Common Patterns

### Loading State
```jsx
<Button loading={isLoading} disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Click Me'}
</Button>
```

### Error Display
```jsx
{error && (
  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
    <p className="text-red-300 text-sm font-medium">{error}</p>
  </div>
)}
```

### Info Box
```jsx
<div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
  <p className="text-blue-300 text-sm font-semibold">Information</p>
</div>
```

### Success Box
```jsx
<div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
  <p className="text-emerald-300 text-sm font-semibold">Success!</p>
</div>
```

## Dark Mode Support

All components include dark mode. Simply apply to parent:
```jsx
<div className="dark">
  {/* Components automatically theme to dark */}
</div>
```

## Accessibility

- All buttons have focus states: `focus:ring-2 focus:ring-emerald-500`
- All inputs have error states
- Form labels are always associated with inputs
- Color contrast meets WCAG AA standards

## Performance

- Components use React.memo to prevent unnecessary re-renders
- Animations use CSS transforms (GPU accelerated)
- Smooth transitions (200-300ms) don't feel laggy
- Glassmorphism uses backdrop-filter (modern browsers)

## Browser Support

Works on:
- Chrome 85+
- Firefox 78+
- Safari 13+
- Edge 85+

## Questions?

Refer to updated pages (Login, Settings) for real-world examples of the new design system in action.
