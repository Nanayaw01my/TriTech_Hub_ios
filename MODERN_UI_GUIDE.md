# TriTech Hub iOS — Modern UI System

A professional, bright design system using TailwindCSS. All pages now feature:
- Light gradient backgrounds (gray-50 to emerald-50)
- Clean white cards with subtle shadows and borders
- Smooth animations and transitions
- Professional typography with clear hierarchy
- Modern form inputs with emerald focus states
- Clean component hierarchy with emerald accents

## Updated Pages ✅

### Admin Pages
- **Admin Dashboard** — Bright gradient background with colored stat pills
- **Admin Settings** — White cards with emerald accents, maintenance mode toggle
- **Customers** — Clean light theme with emerald buttons
- **Staff** — Bright hero with team member list
- **Devices** — Light backgrounds with device catalog
- **Transactions** — Clean transaction history with export
- **Reports** — Analytics dashboard with emerald theme

### Customer Pages
- **Customer Dashboard** — Device status, payment progress, and plan details
- **Customer Profile** — Account information with emerald accents
- **Customer Payments** — Payment history and next installment info

### Staff Pages
- **Staff Dashboard** — Team performance metrics with colored pills
- **Staff Customers** — Customer list with registration tracking

### Authentication & System
- **Login** — Bright gradient with emerald button
- **Splash Screen** — Loading state with logo
- **Maintenance Screen** — Informational design

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
- Light background: `#f9fafb` (gray-50) → `#fafaf9` (emerald tint)
- White: `#ffffff` — Cards and containers
- Light gray: `#e5e7eb` (gray-200) — Borders and dividers

**Semantic Colors:**
- Success: `#10b981` (emerald)
- Error: `#ef4444` (red)
- Warning: `#f59e0b` (amber)
- Info: `#3b82f6` (blue)

**Text:**
- Primary (headings): `#111827` (gray-900)
- Secondary (body): `#6b7280` (gray-500)
- Muted (hints): `#9ca3af` (gray-400)

## Design Patterns

### Background
```jsx
// Light gradient with subtle orbs
<div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
  {/* Subtle background orbs for depth */}
  <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-20" />
  <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-30" />
</div>
```

### Cards (Clean White)
```jsx
<Card padding="p-6 sm:p-8" className="mb-6 shadow-lg">
  {/* Content with white background and subtle shadow */}
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

## Pages Ready for Enhancement

### Future Improvements
- [ ] Customer Detail page (`/admin/customers/:id`) - Add bright theme
- [ ] Overdue Accounts page - Add bright theme
- [ ] Audit Logs page - Add bright theme
- [ ] Search pages - Add bright theme
- [ ] About pages - Add bright theme

All core pages now use the bright, light theme with emerald accents!

## Typography

```jsx
// Headings
<h1 className="text-4xl font-black text-gray-900">Large Title</h1>
<h2 className="text-2xl font-bold text-gray-900">Section Title</h2>
<h3 className="text-lg font-bold text-gray-900">Card Title</h3>

// Body Text
<p className="text-base text-gray-600">Body text</p>
<p className="text-sm text-gray-500">Secondary text</p>
<p className="text-xs text-gray-400">Muted text</p>

// Labels
<label className="text-sm font-semibold text-gray-800">Label</label>
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
  <div className="p-4 rounded-xl bg-red-50 border border-red-200">
    <p className="text-red-700 text-sm font-medium">{error}</p>
  </div>
)}
```

### Info Box
```jsx
<div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
  <p className="text-blue-700 text-sm font-semibold">Information</p>
</div>
```

### Success Box
```jsx
<div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
  <p className="text-emerald-700 text-sm font-semibold">Success!</p>
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
